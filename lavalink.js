const { Shoukaku, Connectors } = require('shoukaku');

const Nodes = [
  { name: 'Trinium-v4', url: '://triniumhost.com', auth: 'free', secure: true },
  { name: 'Vinster-v4', url: 'freelavalinkvinster.in:443', auth: 'youshallnotpass', secure: true },
  { name: 'HeavenCloud-v4', url: 'free-lava.heavencloud.in:4000', auth: 'heavencloud.in', secure: false }
];

let shoukaku = null;
const queues = new Map();

function initLavalink(client) {
  if (shoukaku) return shoukaku;
  shoukaku = new Shoukaku(new Connectors.DiscordJS(client), Nodes, { resume: false, moveOnDisconnect: true });
  shoukaku.on('ready', name => console.log('🎵 Lavalink ses sunucusu bağlandı: ' + name));
  shoukaku.on('error', (name, err) => console.log('Lavalink uyarı (' + name + '):', err.message));
  return shoukaku;
}

function getLavalink() {
  return shoukaku;
}

module.exports = { initLavalink, getLavalink, queues };
