const { Shoukaku, Connectors } = require('shoukaku');

const Nodes = [
  { name: 'HeavenCloud-v4', url: 'free-lava.heavencloud.in:4000', auth: 'heavencloud.in', secure: false },
  { name: 'Serenetia-v4', url: '://serenetia.com', auth: 'BatuManaBisa', secure: true },
  { name: 'Hewkawar-v4', url: 'lavalink.hewkawar.xyz:443', auth: 'HewkawArrPass', secure: true }
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
