import { describe, it, expect } from 'vitest';
import { isValidCpf, stripMask } from '../utils/validators/cpf';

describe('isValidCpf', () => {
  it('aceita CPF válido sem máscara', () => {
    expect(isValidCpf('11144477735')).toBe(true);
  });

  it('aceita CPF válido com máscara', () => {
    expect(isValidCpf('111.444.777-35')).toBe(true);
  });

  it('rejeita CPF com dígitos verificadores errados', () => {
    expect(isValidCpf('11144477734')).toBe(false);
  });

  it('rejeita sequências triviais (000.000.000-00)', () => {
    expect(isValidCpf('00000000000')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('99999999999')).toBe(false);
  });

  it('rejeita CPF com menos de 11 dígitos', () => {
    expect(isValidCpf('1234567')).toBe(false);
  });

  it('rejeita CPF com mais de 11 dígitos', () => {
    expect(isValidCpf('123456789012')).toBe(false);
  });

  it('rejeita string vazia', () => {
    expect(isValidCpf('')).toBe(false);
  });
});

describe('stripMask', () => {
  it('remove pontos e traço', () => {
    expect(stripMask('111.444.777-35')).toBe('11144477735');
  });

  it('mantém somente dígitos', () => {
    expect(stripMask('abc.123-45')).toBe('12345');
  });
});
