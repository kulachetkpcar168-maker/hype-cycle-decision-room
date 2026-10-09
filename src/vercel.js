const { handleApiRequest } = require('./api');
const { clientAddress, createRequestPolicy, resolveApiPathname } = require('./request-policy');

function createVercelHandler({ store, hostKey, readRateLimit, writeRateLimit, readLimit, writeLimit, rateLimit, maxBodyBytes = 16_384 }) {
  if (!hostKey) throw new Error('Missing HOST_KEY configuration');
  const policy = createRequestPolicy({ store, hostKey, readLimit: readRateLimit ?? readLimit ?? rateLimit, writeLimit: writeRateLimit ?? writeLimit ?? rateLimit });
  return async function vercelHandler(request, response) {
    const headers = request.headers || {};
    const pathname = resolveApiPathname(request);
    const client = clientAddress(headers);
    const check = await policy.check({ method: request.method, pathname, headers, client });
    if (!check.allowed) {
      response.setHeader('Cache-Control', 'no-store');
      return response.status(429).json({ error: 'Too many requests' });
    }
    let body;
    try { body = request.body || {}; }
    catch {
      response.setHeader('Cache-Control', 'no-store');
      return response.status(400).json({ error: 'Invalid JSON' });
    }
    if (typeof body === 'string') {
      try { body = JSON.parse(body); }
      catch {
        response.setHeader('Cache-Control', 'no-store');
        return response.status(400).json({ error: 'Invalid JSON' });
      }
    }
    if (Buffer.byteLength(JSON.stringify(body), 'utf8') > maxBodyBytes) {
      response.setHeader('Cache-Control', 'no-store');
      return response.status(413).json({ error: 'Request body too large' });
    }
    const result = await handleApiRequest({
      method: request.method,
      pathname,
      headers: request.headers || {},
      body,
      store,
      hostKey,
    });
    response.setHeader('Cache-Control', 'no-store');
    return response.status(result.status).json(result.body);
  };
}

module.exports = { createVercelHandler };
