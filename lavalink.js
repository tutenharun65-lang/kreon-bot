const { Shoukaku, Connectors } = require('shoukaku');
const Nodes = [{ name: 'Kreon-Ozel-Lavalink', url: 'kreon-lavalink.onrender.com:443', auth: 'kreon-gizli-sifre-2026', secure: true }];
let shoukaku = null;
const queues = new Map();
function initLavalink(client) {
  if (shoukaku) return shoukaku;
  shoukaku = new Shoukaku(new Connectors.DiscordJS(client), Nodes, { resume: true, resumeTimeout: 60, reconnectTries: 999, reconnectInterval: 5000, moveOnDisconnect: true });
  shoukaku.on('ready', name => console.log('Lavalink baglandi: ' + name));
  shoukaku.on('close', (name, code) => console.log('Lavalink yenileniyor:', code));
  shoukaku.on('error', (name, err) => console.log('Lavalink uyari:', err.message));
  setInterval(() => { fetch('https://kreon-lavalink.onrender.com:443'.replace(':443','/version'), { headers: { Authorization: 'kreon-gizli-sifre-2026' } }).catch(() => {}); }, 240000);
  return shoukaku;
}
function getLavalink() { return shoukaku; }
module.exports = { initLavalink, getLavalink, queues };
