const fs = require('node:fs');
const path = require('node:path');
const { makeMatrix, svg } = require('../public/qr');

function main(args = process.argv.slice(2)) {
  if (args.length !== 1 || !/^https?:\/\//.test(args[0])) {
    throw Error('Usage: node scripts/generate-join-qr.js <absolute-url>');
  }
  fs.writeFileSync(path.resolve(__dirname, '../public/join-qr.svg'), svg(args[0]));
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { makeMatrix, svg };
