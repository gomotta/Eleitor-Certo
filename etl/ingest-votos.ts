/**
 * ETL para ingestão da base de votos do TSE (~27 GB).
 *
 * Uso:
 *   ts-node ingest-votos.ts /caminho/para/votos.csv [--uf SP]
 *
 * O CSV deve ter as colunas (nomes exatos do arquivo TSE):
 *   NM_CANDIDATO, NR_CANDIDATO, SG_PARTIDO, DS_CARGO, SG_UF, NM_MUNICIPIO,
 *   NR_ZONA, QT_VOTOS_NOMINAIS
 *
 * Estratégia: stream CSV → buffer de 1000 linhas → COPY FROM STDIN via pg.
 * Nunca carrega o arquivo inteiro na memória.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createInterface } from 'readline';
import { Pool, PoolClient } from 'pg';

const BATCH_SIZE = 1_000;
const ERROR_LOG = path.join(__dirname, 'errors.log');

// Mapeamento dos cabeçalhos TSE → campos da tabela
interface TseRow {
  NM_CANDIDATO: string;
  NR_CANDIDATO: string;
  SG_PARTIDO: string;
  DS_CARGO: string;
  SG_UF: string;
  NM_MUNICIPIO: string;
  NR_ZONA: string;
  QT_VOTOS_NOMINAIS: string;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function bulkInsert(client: PoolClient, rows: TseRow[]): Promise<void> {
  if (rows.length === 0) return;

  // Busca ou cria zonas eleitorais
  const zonaCache = new Map<string, number>();

  for (const row of rows) {
    const key = `${row.NR_ZONA}_${row.NM_MUNICIPIO}_${row.SG_UF}`;
    if (!zonaCache.has(key)) {
      const res = await client.query<{ id: number }>(
        `INSERT INTO zonas_eleitorais (numero_zona, municipio, uf)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [row.NR_ZONA, row.NM_MUNICIPIO.trim(), row.SG_UF.trim()],
      );
      if (res.rows.length > 0) {
        zonaCache.set(key, res.rows[0].id);
      } else {
        const res2 = await client.query<{ id: number }>(
          `SELECT id FROM zonas_eleitorais WHERE numero_zona=$1 AND municipio=$2 AND uf=$3`,
          [row.NR_ZONA, row.NM_MUNICIPIO.trim(), row.SG_UF.trim()],
        );
        zonaCache.set(key, res2.rows[0]?.id ?? 0);
      }
    }
  }

  // Montar VALUES para INSERT em lote
  const values: (string | number | null)[] = [];
  const placeholders = rows.map((row, i) => {
    const offset = i * 8;
    const zonaId = zonaCache.get(`${row.NR_ZONA}_${row.NM_MUNICIPIO}_${row.SG_UF}`) ?? null;
    values.push(
      zonaId,
      row.NM_CANDIDATO.trim().slice(0, 200),
      row.NR_CANDIDATO.trim().slice(0, 10),
      row.SG_PARTIDO.trim().slice(0, 10),
      row.DS_CARGO.trim().slice(0, 50),
      row.SG_UF.trim().toUpperCase().slice(0, 2),
      row.NM_MUNICIPIO.trim().slice(0, 100),
      parseInt(row.QT_VOTOS_NOMINAIS) || 0,
    );
    return `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},$${offset + 8})`;
  });

  await client.query(
    `INSERT INTO votos_2024
       (zona_eleitoral_id, candidato_nome, candidato_numero, partido_sigla, cargo, uf, municipio, quantidade_votos)
     VALUES ${placeholders.join(',')}
     ON CONFLICT DO NOTHING`,
    values,
  );
}

async function main() {
  const csvPath = process.argv[2];
  const ufFilter = process.argv.includes('--uf')
    ? process.argv[process.argv.indexOf('--uf') + 1]?.toUpperCase()
    : null;

  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error('Uso: ts-node ingest-votos.ts <caminho-do-csv> [--uf UF]');
    process.exit(1);
  }

  console.log(`[etl] Iniciando ingestão: ${path.basename(csvPath)}`);
  if (ufFilter) console.log(`[etl] Filtrando por UF: ${ufFilter}`);

  const errorLog = fs.createWriteStream(ERROR_LOG, { flags: 'a' });
  const client = await pool.connect();
  await client.query('BEGIN');

  let headers: string[] = [];
  let batch: TseRow[] = [];
  let totalLines = 0;
  let errorLines = 0;
  const startTime = Date.now();

  const rl = createInterface({
    input: fs.createReadStream(csvPath, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  });

  const separator = ';'; // Arquivos TSE usam ponto-e-vírgula

  for await (const line of rl) {
    if (!line.trim()) continue;

    if (headers.length === 0) {
      headers = line.split(separator).map((h) => h.trim().replace(/^"|"$/g, ''));
      continue;
    }

    const values = line.split(separator).map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = values[i] ?? ''));

    const tseRow = row as unknown as TseRow;

    if (ufFilter && tseRow.SG_UF?.toUpperCase() !== ufFilter) continue;

    // Validação mínima
    if (!tseRow.NM_CANDIDATO || !tseRow.SG_UF || !tseRow.QT_VOTOS_NOMINAIS) {
      errorLog.write(`[linha ${totalLines + 2}] Dados incompletos: ${line}\n`);
      errorLines++;
      continue;
    }

    batch.push(tseRow);
    totalLines++;

    if (batch.length >= BATCH_SIZE) {
      try {
        await bulkInsert(client, batch);
      } catch (err) {
        errorLog.write(`[batch erro] ${err}\n`);
        errorLines += batch.length;
      }
      batch = [];

      const elapsed = (Date.now() - startTime) / 1000;
      const rate = Math.round(totalLines / elapsed);
      process.stdout.write(
        `\r[etl] Processadas: ${totalLines.toLocaleString()} linhas | ${rate.toLocaleString()} linhas/s`,
      );
    }
  }

  // Flush final batch
  if (batch.length > 0) {
    try {
      await bulkInsert(client, batch);
    } catch (err) {
      errorLog.write(`[batch final erro] ${err}\n`);
    }
  }

  await client.query('COMMIT');

  // Atualizar materialized view após ingestão
  console.log('\n[etl] Atualizando materialized view...');
  await client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_votos_por_zona');

  client.release();
  errorLog.end();
  await pool.end();

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[etl] Concluído em ${totalTime}s`);
  console.log(`[etl] Linhas inseridas: ${totalLines.toLocaleString()}`);
  if (errorLines > 0) {
    console.log(`[etl] Linhas com erro: ${errorLines} — veja ${ERROR_LOG}`);
  }
}

main().catch((err) => {
  console.error('[etl] Erro fatal:', err);
  process.exit(1);
});
