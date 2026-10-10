const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { svg } = require('../scripts/generate-join-qr');
const browserQr = require('../public/qr');

function modulesFromSvg(source) {
  const size = Number(source.match(/viewBox="0 0 (\d+) \d+"/)[1]);
  const quiet = 4;
  const matrix = Array.from({ length: size - quiet * 2 }, () => Array(size - quiet * 2).fill(false));
  for (const match of source.matchAll(/<rect x="(\d+)" y="(\d+)" width="1" height="1"\/>/g)) {
    const x = Number(match[1]) - quiet;
    const y = Number(match[2]) - quiet;
    if (x >= 0 && y >= 0 && y < matrix.length && x < matrix.length) matrix[y][x] = true;
  }
  return matrix;
}
function reservedModules(size) {
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));
  const set = (x, y) => { if (x >= 0 && y >= 0 && x < size && y < size) reserved[y][x] = true; };
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) for (let dy = -4; dy <= 4; dy += 1) for (let dx = -4; dx <= 4; dx += 1) set(cx + dx, cy + dy);
  for (let index = 8; index < size - 8; index += 1) { set(index, 6); set(6, index); }
  for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) set(26 + dx, 26 + dy);
  for (let index = 0; index < 9; index += 1) if (index !== 6) { set(8, index); set(index, 8); }
  for (let index = 0; index < 8; index += 1) { set(size - 1 - index, 8); set(8, size - 1 - index); }
  set(8, size - 8);
  return reserved;
}
const masks = [
  (x, y) => (x + y) % 2 === 0, (_x, y) => y % 2 === 0, (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => (x * y) % 2 + (x * y) % 3 === 0, (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
  (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0,
];
function decodePayload(matrix) {
  const size = matrix.length;
  const reserved = reservedModules(size);
  for (let mask = 0; mask < masks.length; mask += 1) {
    const bits = [];
    let upward = true;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right -= 1;
      for (let step = 0; step < size; step += 1) {
        const y = upward ? size - 1 - step : step;
        for (let offset = 0; offset < 2; offset += 1) {
          const x = right - offset;
          if (!reserved[y][x]) bits.push(Number(matrix[y][x] !== masks[mask](x, y)));
        }
      }
      upward = !upward;
    }
    const read = (start, length) => Number.parseInt(bits.slice(start, start + length).join(''), 2);
    if (read(0, 4) !== 4) continue;
    const length = read(4, 8);
    if (length < 1 || length > 78) continue;
    const payload = Buffer.from(Array.from({ length }, (_, index) => read(12 + index * 8, 8))).toString('utf8');
    if (/^https?:\/\//.test(payload)) return payload;
  }
  throw new Error('QR payload was not decodable');
}
test('standard-library QR generator encodes arbitrary explicit root URLs into actual modules', () => {
  for (const url of ['https://hype-cycle-decision-room.vercel.app/', 'https://classroom.example/room/']) assert.equal(decodePayload(modulesFromSvg(svg(url))), url);
});
test('checked-in fallback QR modules decode to the configured production root', () => {
  assert.equal(decodePayload(modulesFromSvg(fs.readFileSync(path.join(__dirname, '../public/join-qr.svg'), 'utf8'))), 'https://hype-cycle-decision-room.vercel.app/');
});

test('browser QR generator encodes a signed spectator URL', () => {
  const url = 'https://hype-cycle-decision-room.vercel.app/?s=a.ABCDEFGHIJKLMNOPQRSTUV';
  assert.equal(decodePayload(modulesFromSvg(browserQr.svg(url))), url);
  assert.match(browserQr.svgDataUrl(url), /^data:image\/svg\+xml/);
});
