# Eleitor Certo

Sistema web para candidatos políticos brasileiros visualizarem dados eleitorais de 2024 em mapa interativo, com copiloto personalizado de campanha.

## Pré-requisitos

- Docker Desktop (com Docker Compose)
- Node.js 22+ (para rodar fora do Docker)
- npm 10+

## Setup rápido (Docker)

```bash
# 1. Copie e ajuste as variáveis de ambiente
cp .env.example .env
# Edite .env: preencha JWT_SECRET, JWT_REFRESH_SECRET e ENCRYPTION_KEY

# 2. Suba os serviços
docker-compose up -d

# 3. Rode as migrations
docker-compose exec backend npm run migrate

# 4. Rode os seeds (partidos + IBGE)
docker-compose exec backend npm run seed
```

Acesse em: http://localhost:5173

## Desenvolvimento local (npm run dev)

A forma mais simples: usar Docker apenas para os bancos e rodar backend/frontend localmente.

```bash
# 1. Sobe só PostgreSQL e Redis
docker-compose -f docker-compose.dev.yml up -d

# 2. Backend (terminal 1)
cd backend
npm install
# O arquivo backend/.env já vem configurado para localhost
npx prisma migrate dev --name init   # cria as tabelas (precisa do Postgres rodando)
npm run seed                          # popula partidos + IBGE (~5 min)
npm run dev                           # http://localhost:3001

# 3. Frontend (terminal 2)
cd frontend
npm install
npm run dev                           # http://localhost:5173
```

## Migrations e Seeds

```bash
# Aplicar migrations
npm run migrate          # (produção)
npm run migrate:dev      # (desenvolvimento, cria arquivos de migration)

# Popular banco
npm run seed             # partidos TSE + estados/cidades/regiões do IBGE (~5 min)
```

## Ingestão da base de votos (27 GB)

O script ETL usa streaming — nunca carrega o arquivo inteiro na memória.

```bash
cd etl
npm install

# Ingerir arquivo CSV completo
DATABASE_URL=postgresql://... ts-node ingest-votos.ts /caminho/votos_2024.csv

# Ingerir apenas uma UF
DATABASE_URL=postgresql://... ts-node ingest-votos.ts /caminho/votos_2024.csv --uf SP
```

O arquivo CSV deve ser do formato TSE com separador `;` e encoding `latin1`.  
Colunas obrigatórias: `NM_CANDIDATO`, `NR_CANDIDATO`, `SG_PARTIDO`, `DS_CARGO`, `SG_UF`, `NM_MUNICIPIO`, `NR_ZONA`, `QT_VOTOS_NOMINAIS`.

## Testes

```bash
cd backend
npm test
```

Testes unitários cobrem: validador de CPF, validações dos blocos do copiloto e agregação de votos.

## Arquitetura

```
eleitor-certo/
├── backend/          Node.js + Express + TypeScript + Prisma + PostGIS
├── frontend/         React 18 + Vite + TypeScript + Tailwind + Leaflet
├── etl/              Script de ingestão streaming (CSV → PostgreSQL)
└── docker-compose.yml
```

### Principais decisões técnicas

| Decisão | Motivo |
|---|---|
| PostgreSQL + PostGIS | Suporte nativo a geometrias e consultas espaciais (ST_AsGeoJSON) |
| Particionamento `votos_2024` por UF | Consultas até 27x mais rápidas em tabela de 27 GB |
| Materialized View `mv_votos_por_zona` | Agrega votos por candidato/zona uma vez; consultas do mapa em <500ms |
| Redis TTL 1h | Dados de 2024 são estáticos; evita recalcular a cada request |
| AES-256-GCM para CPF/título | LGPD: dados sensíveis nunca em plaintext no banco |
| Streaming no ETL | 27 GB não cabem na memória; readline + batch INSERT |

## Variáveis de ambiente

Ver `.env.example` para a lista completa. Variáveis obrigatórias:

- `DATABASE_URL` — connection string PostgreSQL
- `REDIS_URL` — connection string Redis
- `JWT_SECRET` — string aleatória longa (mín. 32 chars)
- `JWT_REFRESH_SECRET` — outra string aleatória
- `ENCRYPTION_KEY` — chave hex de 32 bytes (64 chars hex) para AES-256

Gere chaves seguras:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Conformidade LGPD

- `GET /api/candidates/export` — exporta todos os dados do candidato (incluindo CPF/título descriptografados)
- `DELETE /api/candidates/me` — exclui todos os dados do candidato em cascata
