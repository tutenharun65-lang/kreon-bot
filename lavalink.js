const { Shoukaku, Connectors } = require('shoukaku');

const Nodes = [
  { name: 'Ana-Node', url: '://serenetia.com', auth: 'https://dsc.gg/ajidevserver', secure: true },
  { name: 'Yedek-Node', url: 'v4.lavalink.rocks:443', auth: 'horizxon.tech', secure: true }
];

let shoukaku = null;
const queues = new Map();

function initLavalink(client) {
  shoukaku = new Shoukaku(new Connectors.DiscordJS(client), Nodes, { resume: false, moveOnDisconnect: true });
  shoukaku.on('ready', name => console.log('🎵 Lavalink ses sunucusu bağlandı: ' + name));
  shoukaku.on('error', (name, err) => console.log('Lavalink uyarı (' + name + '):', err.message));
  return shoukaku;
}

function getLavalink() {
  return shoukaku;
}

module.exports = { initLavalink, getLavalink, queues };
