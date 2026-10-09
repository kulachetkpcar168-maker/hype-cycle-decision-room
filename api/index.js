const { createUpstashStore } = require('../src/store');
const { createVercelHandler } = require('../src/vercel');

const store = createUpstashStore({
  key: process.env.GAME_STATE_KEY || 'hype-cycle:decision-room',
});

module.exports = createVercelHandler({
  store,
  hostKey: process.env.HOST_KEY,
});
