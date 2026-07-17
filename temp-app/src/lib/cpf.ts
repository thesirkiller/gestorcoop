// Validação de CPF compartilhada entre frontend e API (dígitos verificadores).
export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // 000.000.000-00, 111... etc.

  const calcCheckDigit = (base: string, factor: number) => {
    let sum = 0;
    for (const digit of base) {
      sum += Number(digit) * factor--;
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = calcCheckDigit(digits.substring(0, 9), 10);
  if (d1 !== Number(digits[9])) return false;
  const d2 = calcCheckDigit(digits.substring(0, 10), 11);
  return d2 === Number(digits[10]);
}

export function cpfDigits(cpf: string): string {
  return cpf.replace(/\D/g, '');
}
