/**
 * Preload de testes (`node --require`): troca `@cloudflare/next-on-pages` por um
 * stub. O pacote real não tem entrada para Node ("No exports main defined") e,
 * mesmo que tivesse, `getRequestContext` recusa rodar fora do runtime edge.
 *
 * O stub lê o mesmo símbolo global que o runtime da Cloudflare usa, então os
 * testes injetam o binding D1 com:
 *   globalThis[Symbol.for('__cloudflare-request-context__')] = { env: { DB } }
 */
const Module = require('node:module');
const path = require('node:path');

const stub = path.join(__dirname, 'next-on-pages-stub.cjs');
const resolverOriginal = Module._resolveFilename;
Module._resolveFilename = function (request, ...resto) {
  if (request === '@cloudflare/next-on-pages') return stub;
  return resolverOriginal.call(this, request, ...resto);
};
