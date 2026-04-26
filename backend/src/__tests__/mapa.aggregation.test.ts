import { describe, it, expect } from 'vitest';

// Lógica pura de agregação extraída do MapaService para teste unitário
function calcPercentual(votosZona: number, totalZona: number): number {
  if (totalZona === 0) return 0;
  return parseFloat(((votosZona / totalZona) * 100).toFixed(2));
}

function calcRanking(
  candidatoVotos: number,
  todosOsVotos: number[],
): number {
  const sorted = [...todosOsVotos].sort((a, b) => b - a);
  return sorted.indexOf(candidatoVotos) + 1;
}

describe('Agregação de votos — percentual', () => {
  it('calcula percentual corretamente', () => {
    expect(calcPercentual(500, 2000)).toBe(25.0);
  });

  it('retorna 0 se total for 0', () => {
    expect(calcPercentual(100, 0)).toBe(0);
  });

  it('retorna 100 se candidato tem todos os votos', () => {
    expect(calcPercentual(1000, 1000)).toBe(100.0);
  });
});

describe('Agregação de votos — ranking', () => {
  it('candidato com mais votos é #1', () => {
    expect(calcRanking(1000, [1000, 800, 600, 400])).toBe(1);
  });

  it('candidato com menos votos é último', () => {
    expect(calcRanking(400, [1000, 800, 600, 400])).toBe(4);
  });

  it('ranking de candidato com votos iguais ao primeiro', () => {
    expect(calcRanking(1000, [1000, 1000, 600])).toBe(1);
  });
});
