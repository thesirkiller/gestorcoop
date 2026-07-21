/**
 * Gera um número de série/patrimônio baseado na marca e modelo fornecidos.
 * Ex: Marca "Philips", Modelo "EverFlo" -> "PHIL-EVER-1234"
 * Se faltar marca/modelo -> "EQP-12345"
 */
export function generateSerialNumber(marca?: string, modelo?: string): string {
  const sanitize = (str: string) =>
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();

  const cleanMarca = marca ? sanitize(marca) : '';
  const cleanModelo = modelo ? sanitize(modelo) : '';

  let prefix = '';

  if (cleanMarca && cleanModelo) {
    prefix = `${cleanMarca.slice(0, 4)}-${cleanModelo.slice(0, 4)}`;
  } else if (cleanMarca) {
    prefix = `${cleanMarca.slice(0, 4)}`;
  } else if (cleanModelo) {
    prefix = `${cleanModelo.slice(0, 4)}`;
  } else {
    prefix = 'EQP';
  }

  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${randomNum}`;
}
