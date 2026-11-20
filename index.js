const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { Client, Collection, Events, GatewayIntentBits, ChannelType } = require('discord.js');
require('dotenv').config();
const { connectDB, getSettings, saveSettings, registerSystems } = require('./systems');

const app = express();
const port = process.env.PORT || 3000;
const clientId = (process.env.CLIENT_ID || '1569848116973277234').replace(/\D/g, '') || '1569848116973277234';
const redirectUri = 'https://onrender.com';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });
connectDB(); registerSystems(client);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function getSession(req) {
    const cookie = (req.headers.cookie || '').split(';').find(c => c.trim().startsWith('kreon_sess='));
    if (!cookie) return null;
    try { return JSON.parse(Buffer.from(cookie.trim().substring(11), 'base64').toString('utf8')); } catch { return null; }
}

app.get('/dashboard', (req, res) => { if (!getSession(req)) return res.redirect('/login'); res.sendFile(path.join(__dirname, 'public', 'dashboard.html')); });
app.get('/login', (req, res) => res.redirect('https://discord.com'));
app.get('/', (req, res, next) => { if (req.query.code) return res.redirect('/auth/callback?code=' + req.query.code); next(); });
app.get('/logout', (req, res) => { res.setHeader('Set-Cookie', 'kreon_sess=; Path=/; Max-Age=0'); res.redirect('/'); });

app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('Hata: Discord onay kodu gelmedi.');
    if (!process.env.CLIENT_SECRET) return res.send('Hata: Render Environment icinde CLIENT_SECRET eksik!');
    try {
        const tokenRes = await fetch('https://discord.com', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: process.env.CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: redirectUri }) });
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) return res.send('Discord OAuth2 Hatasi: ' + JSON.stringify(tokenData));
        const user = await (await fetch('https://discord.com', { headers: { Authorization: `Bearer ${tokenData.access_token}` } })).json();
        const rawGuilds = await (await fetch('https://discord.com/guilds', { headers: { Authorization: `Bearer ${tokenData.access_token}` } })).json();
        const manageable = Array.isArray(rawGuilds) ? rawGuilds.filter(g => (BigInt(g.permissions) & 0x20n) === 0x20n || (BigInt(g.permissions) & 0x8n) === 0x8n).map(g => ({ id: g.id, name: g.name, icon: g.icon, owner: g.owner })) : [];
        const payload = Buffer.from(JSON.stringify({ user: { id: user.id, username: user.username, avatar: user.avatar }, guilds: manageable, owner: g.owner })).toString('base64');
        res.setHeader('Set-Cookie', `kreon_sess=${payload}; Path=/; HttpOnly; Max-Age=86400`);
        res.redirect('/dashboard');
    } catch (e) { res.send('Baglanti Hatasi: ' + e.message); }
});

app.get('/api/me', (req, res) => { const s = getSession(req); if (!s) return res.status(401).json({ error: 'Giriş gerekli' }); res.json({ user: s.user, guilds: s.guilds.map(g => ({ ...g, botIn: client.guilds.cache.has(g.id) })) }); });
app.get('/api/guild/:id', async (req, res) => { const g = client.guilds.cache.get(req.params.id); if (!g) return res.status(404).json({ error: 'Yok' }); res.json({ settings: await getSettings(g.id), channels: g.channels.cache.filter(c => c.type === ChannelType.GuildText).map(c => ({ id: c.id, name: c.name })) }); });
app.post('/api/guild/:id', async (req, res) => { await saveSettings(req.params.id, req.body); res.json({ ok: true }); });
app.get('/invite', (req, res) => res.redirect(`https://discord.com{clientId}&permissions=8&scope=bot%20applications.commands${req.query.guild_id ? '&guild_id=' + req.query.guild_id : ''}`));
app.get('/api/stats', (req, res) => res.json({ guilds: client.guilds.cache.size, users: client.guilds.cache.reduce((a, g) => a + (g.memberCount || 0), 0), ping: client.ws.ping > 0 ? client.ws.ping : 24 }));
app.listen(port, () => console.log(`🌐 Site ve Kontrol Paneli ${port} portunda aktif.`));

client.commands = new Collection();
for (const folder of fs.readdirSync(path.join(__dirname, 'commands'))) {
    const p = path.join(__dirname, 'commands', folder);
    for (const file of fs.readdirSync(p).filter(f => f.endsWith('.js'))) { const c = require(path.join(p, file)); if ('data' in c && 'execute' in c) client.commands.set(c.data.name, c); }
}
client.once(Events.ClientReady, c => console.log(`✅ Kreon Bot aktif: ${c.user.tag}`));
client.on(Events.InteractionCreate, async i => { if (!i.isChatInputCommand()) return; const c = client.commands.get(i.commandName); if (c) try { await c.execute(i); } catch (e) { console.error(e); } });
client.login(process.env.TOKEN);







