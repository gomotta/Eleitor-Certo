import 'dotenv/config';
import { seedPartidos } from './partidos';
import { seedIBGE } from './ibge';
import prisma from '../prisma';

async function main() {
  console.log('[seed] Iniciando...');
  await seedPartidos();
  await seedIBGE();
  console.log('[seed] Concluído.');
}

main()
  .catch((err) => {
    console.error('[seed] Erro:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
