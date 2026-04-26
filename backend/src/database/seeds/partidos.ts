import prisma from '../prisma';

const PARTIDOS = [
  { sigla: 'PT', nome: 'Partido dos Trabalhadores', numero: 13, ideologia: 'Esquerda' },
  { sigla: 'PL', nome: 'Partido Liberal', numero: 22, ideologia: 'Direita' },
  { sigla: 'UNION', nome: 'União Brasil', numero: 44, ideologia: 'Centro-direita' },
  { sigla: 'PP', nome: 'Progressistas', numero: 11, ideologia: 'Centro-direita' },
  { sigla: 'PSD', nome: 'Partido Social Democrático', numero: 55, ideologia: 'Centro' },
  { sigla: 'MDB', nome: 'Movimento Democrático Brasileiro', numero: 15, ideologia: 'Centro' },
  { sigla: 'REPUBLICANOS', nome: 'Republicanos', numero: 10, ideologia: 'Centro-direita' },
  { sigla: 'PDT', nome: 'Partido Democrático Trabalhista', numero: 12, ideologia: 'Centro-esquerda' },
  { sigla: 'PSDB', nome: 'Partido da Social Democracia Brasileira', numero: 45, ideologia: 'Centro' },
  { sigla: 'PSOL', nome: 'Partido Socialismo e Liberdade', numero: 50, ideologia: 'Esquerda' },
  { sigla: 'PSB', nome: 'Partido Socialista Brasileiro', numero: 40, ideologia: 'Centro-esquerda' },
  { sigla: 'AVANTE', nome: 'Avante', numero: 70, ideologia: 'Centro' },
  { sigla: 'PODE', nome: 'Podemos', numero: 20, ideologia: 'Centro' },
  { sigla: 'SOLIDARIEDADE', nome: 'Solidariedade', numero: 77, ideologia: 'Centro' },
  { sigla: 'PATRIOTA', nome: 'Patriota', numero: 51, ideologia: 'Direita' },
  { sigla: 'PRD', nome: 'Partido Renovação Democrática', numero: 25, ideologia: 'Centro-direita' },
  { sigla: 'PCdoB', nome: 'Partido Comunista do Brasil', numero: 65, ideologia: 'Esquerda' },
  { sigla: 'NOVO', nome: 'Novo', numero: 30, ideologia: 'Direita' },
  { sigla: 'REDE', nome: 'Rede Sustentabilidade', numero: 18, ideologia: 'Centro-esquerda' },
  { sigla: 'DC', nome: 'Democracia Cristã', numero: 27, ideologia: 'Centro' },
  { sigla: 'PMN', nome: 'Partido da Mobilização Nacional', numero: 33, ideologia: 'Centro' },
  { sigla: 'UP', nome: 'Unidade Popular', numero: 80, ideologia: 'Esquerda' },
  { sigla: 'AGIR', nome: 'Agir', numero: 36, ideologia: 'Centro' },
  { sigla: 'PTC', nome: 'Partido Trabalhista Cristão', numero: 41, ideologia: 'Centro' },
  { sigla: 'PMB', nome: 'Partido da Mulher Brasileira', numero: 35, ideologia: 'Centro' },
  { sigla: 'PRTB', nome: 'Partido Renovador Trabalhista Brasileiro', numero: 28, ideologia: 'Direita' },
  { sigla: 'PCO', nome: 'Partido da Causa Operária', numero: 29, ideologia: 'Esquerda' },
  { sigla: 'PCB', nome: 'Partido Comunista Brasileiro', numero: 21, ideologia: 'Esquerda' },
  { sigla: 'PSTU', nome: 'Partido Socialista dos Trabalhadores Unificado', numero: 16, ideologia: 'Esquerda' },
];

export async function seedPartidos() {
  console.log('[seed] Populando partidos...');
  for (const partido of PARTIDOS) {
    await prisma.partidos.upsert({
      where: { sigla: partido.sigla },
      update: partido,
      create: partido,
    });
  }
  console.log(`[seed] ${PARTIDOS.length} partidos inseridos.`);
}
