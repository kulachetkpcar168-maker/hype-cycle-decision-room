const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { handleApiRequest } = require('./api');
const { createFileStore } = require('./store');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');

function readJsonBody(request, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { reject(new Error('Request body too large')); request.destroy(); return; }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    request.on('error', reject);
  });
}

function sendJson(response, status, data) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(data));
}

function contentType(filePath) {
  return { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' }[path.extname(filePath)] || 'application/octet-stream';
}

function createRateLimiter(limit = 180, windowMs = 60_000) {
  const clients = new Map();
  return (key) => {
    const now = Date.now();
    const record = clients.get(key);
    if (!record || now - record.startedAt >= windowMs) { clients.set(key, { count: 1, startedAt: now }); return true; }
    record.count += 1;
    return record.count <= limit;
  };
}

function createAppServer(options = {}) {
  const storagePath = options.storagePath || process.env.STATE_FILE || path.join(PROJECT_ROOT, 'data', 'state.json');
  const hostKey = options.hostKey || process.env.HOST_KEY;
  if (!hostKey) throw new Error('HOST_KEY is required');
  const store = options.store || createFileStore(storagePath);
  const allowRequest = createRateLimiter(options.rateLimit || 180);

  return http.createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (pathname.startsWith('/api/')) {
        const client = request.socket.remoteAddress || 'unknown';
        if (!allowRequest(client)) return sendJson(response, 429, { error: 'Too many requests' });
        const body = ['POST', 'PUT', 'PATCH'].includes(request.method) ? await readJsonBody(request) : {};
        const result = await handleApiRequest({ method: request.method, pathname, headers: request.headers, body, store, hostKey });
        return sendJson(response, result.status, result.body);
      }

      const routeFile = pathname === '/' ? 'index.html' : pathname === '/host' ? 'host.html' : pathname.slice(1);
      const resolved = path.resolve(PUBLIC_DIR, routeFile);
      if (!resolved.startsWith(`${PUBLIC_DIR}${path.sep}`)) { response.writeHead(403); return response.end('Forbidden'); }
      fs.readFile(resolved, (error, data) => {
        if (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'content-type': 'text/plain; charset=utf-8' }); response.end(error.code === 'ENOENT' ? 'Not found' : 'Server error'); return; }
        response.writeHead(200, { 'content-type': contentType(resolved), 'cache-control': resolved.endsWith('.html') ? 'no-store' : 'public, max-age=300' });
        response.end(data);
      });
    } catch (error) {
      sendJson(response, /Invalid|too large/i.test(error.message) ? 400 : 500, { error: error.message });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4871);
  const host = process.env.HOST || '0.0.0.0';
  createAppServer().listen(port, host, () => console.log(`Hype Cycle Decision Room running at http://${host}:${port}`));
}

module.exports = { createAppServer, createRateLimiter };
