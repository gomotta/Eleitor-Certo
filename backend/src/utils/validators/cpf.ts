export function stripMask(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

export function isValidCpf(raw: string): boolean {
  const digits = stripMask(raw);

  if (digits.length !== 11) return false;

  // Rejeita sequências triviais (111.111.111-11, etc.)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calc = (len: number): number => {
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += parseInt(digits[i]) * (len + 1 - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calc(9) === parseInt(digits[9]) && calc(10) === parseInt(digits[10]);
}
