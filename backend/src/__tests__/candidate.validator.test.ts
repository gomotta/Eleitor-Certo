import { describe, it, expect } from 'vitest';
import { candidateSchema } from '../validators/candidate.validator';

const baseValid = {
  nomeCompleto: 'João da Silva Santos',
  nomeUrna: 'JOÃO SILVA',
  numeroUrna: '1234',
  partidoSigla: 'PT',
  partidoNome: 'Partido dos Trabalhadores',
  cpf: '111.444.777-35',
  tituloEleitor: '1234 5678 9012',
  emailContato: 'joao@exemplo.com',
  telefone: '(11) 99999-9999',
  cargo: 'VEREADOR',
  estado: 'SP',
  cidade: 'São Paulo',
  bandeiras: ['Saúde', 'Educação', 'Segurança pública'],
  perfilAtuacao: 'Comunitário / Liderança Local',
} as const;

describe('candidateSchema — Bloco 1', () => {
  it('valida candidato completo e correto', () => {
    const result = candidateSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });

  it('rejeita nome com menos de 3 palavras', () => {
    const result = candidateSchema.safeParse({ ...baseValid, nomeCompleto: 'João Silva' });
    expect(result.success).toBe(false);
  });

  it('rejeita nomeUrna com mais de 30 caracteres', () => {
    const result = candidateSchema.safeParse({ ...baseValid, nomeUrna: 'A'.repeat(31) });
    expect(result.success).toBe(false);
  });

  it('rejeita e-mail inválido', () => {
    const result = candidateSchema.safeParse({ ...baseValid, emailContato: 'nao-e-email' });
    expect(result.success).toBe(false);
  });

  it('rejeita telefone sem DDD', () => {
    const result = candidateSchema.safeParse({ ...baseValid, telefone: '99999-9999' });
    expect(result.success).toBe(false);
  });

  it('rejeita CPF inválido', () => {
    const result = candidateSchema.safeParse({ ...baseValid, cpf: '111.111.111-11' });
    expect(result.success).toBe(false);
  });
});

describe('candidateSchema — Bloco 4', () => {
  it('rejeita menos de 3 bandeiras', () => {
    const result = candidateSchema.safeParse({ ...baseValid, bandeiras: ['Saúde', 'Educação'] });
    expect(result.success).toBe(false);
  });

  it('rejeita mais de 3 bandeiras', () => {
    const result = candidateSchema.safeParse({
      ...baseValid,
      bandeiras: ['Saúde', 'Educação', 'Segurança pública', 'Juventude'],
    });
    expect(result.success).toBe(false);
  });

  it('aceita exatamente 3 bandeiras', () => {
    const result = candidateSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });
});
