const { handleApiRequest } = require('./api');

function createVercelHandler({ store, hostKey, rateLimit = 180, rateWindowMs = 60_000, maxBodyBytes = 16_384 }) {
  if (!hostKey) throw new Error('Missing HOST_KEY configuration');
  return async function vercelHandler(request, response) {
    const headers = request.headers || {};
    const client = (headers['x-vercel-forwarded-for'] || headers['x-forwarded-for'] || 'unknown')
      .split(',')[0].trim();
    if (!await store.consumeRateLimit(client, rateLimit, rateWindowMs)) {
      response.setHeader('Cache-Control', 'no-store');
      return response.status(429).json({ error: 'Too many requests' });
    }
    const route = request.query?.route;
    const parts = Array.isArray(route) ? route : route ? [route] : [];
    const pathname = `/api/${parts.join('/')}`;
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
