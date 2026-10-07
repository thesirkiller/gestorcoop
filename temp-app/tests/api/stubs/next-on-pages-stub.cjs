const SIMBOLO = Symbol.for('__cloudflare-request-context__');

exports.getOptionalRequestContext = () => globalThis[SIMBOLO];
exports.getRequestContext = () => {
  const contexto = globalThis[SIMBOLO];
  if (!contexto) throw new Error('Sem contexto Cloudflare (stub de teste).');
  return contexto;
};
