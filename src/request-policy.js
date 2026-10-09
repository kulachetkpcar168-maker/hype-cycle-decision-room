const crypto = require('node:crypto');

const DEFAULT_READ_LIMIT = 3000;
const DEFAULT_WRITE_LIMIT = 180;
const WINDOW_MS = 60_000;

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function hostKeysEqual(expected, supplied) {
  if (typeof expected !== 'string' || expected.length === 0 || typeof supplied !== 'string') return false;
  const expectedHash = crypto.createHash('sha256').update(expected, 'utf8').digest();
  const suppliedHash = crypto.createHash('sha256').update(supplied, 'utf8').digest();
  return crypto.timingSafeEqual(expectedHash, suppliedHash);
}

function resolveApiPathname(request = {}) {
  let pathname = '';
  if (request.url) {
    try { pathname = new URL(request.url, 'http://localhost').pathname; }
    catch { pathname = ''; }
  }
  if (pathname !== '/api' && pathname.startsWith('/api/')) return pathname;
  const route = request.query?.route;
  const parts = Array.isArray(route) ? route : route ? String(route).split('/') : [];
  return `/api/${parts.filter(Boolean).join('/')}`;
}

function clientAddress(headers = {}, fallback = 'unknown') {
  return String(headers['x-vercel-forwarded-for'] || headers['x-forwarded-for'] || fallback || 'unknown')
    .split(',')[0].trim() || 'unknown';
}

function createRequestPolicy(options) {
  const { store, hostKey } = options;
  const readLimit = positiveInteger(options.readLimit ?? process.env.RATE_LIMIT_READ_PER_MIN, DEFAULT_READ_LIMIT);
  const writeLimit = positiveInteger(options.writeLimit ?? process.env.RATE_LIMIT_WRITE_PER_MIN, DEFAULT_WRITE_LIMIT);
  return {
    async check({ method, pathname, headers = {}, client = 'unknown' }) {
      const isHostRoute = pathname.startsWith('/api/host/');
      const authenticatedHost = isHostRoute && hostKeysEqual(hostKey, headers['x-host-key']);
      if (authenticatedHost) return { allowed: true, authenticatedHost: true, bucket: null };
      const bucket = method === 'GET' && pathname === '/api/state' ? 'read' : 'write';
      const limit = bucket === 'read' ? readLimit : writeLimit;
      const allowed = await store.consumeRateLimit(`${bucket}:${client}`, limit, WINDOW_MS);
      return { allowed, authenticatedHost: false, bucket };
    },
  };
}

module.exports = {
  DEFAULT_READ_LIMIT,
  DEFAULT_WRITE_LIMIT,
  WINDOW_MS,
  clientAddress,
  createRequestPolicy,
  hostKeysEqual,
  positiveInteger,
  resolveApiPathname,
};
