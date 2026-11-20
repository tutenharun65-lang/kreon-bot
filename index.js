const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { Client, Collection, Events, GatewayIntentBits, ChannelType } = require('discord.js');
const { connectDB, getSettings, saveSettings, registerSystems } = require('./systems');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

connectDB();
registerSystems(client);
app.use(express.json());

function getAppId() {
    return client.user?.id || (process.env.CLIENT_ID || '').replace(/\D/g, '') || '1569848116973277234';
}

function buildDiscordAuthUrl() {
    const u = new URL('https://discord.com');
    u.searchParams.set('client_id', getAppId());
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('redirect_uri', 'https://onrender.com');
    u.searchParams.set('scope', 'identify guilds');
    return u.toString();
}

function getSession(req) {
    const cookie = (req.headers.cookie || '').split(';').find(c => c.trim().startsWith('kreon_sess='));
    if (!cookie) return null;
    try { return JSON.parse(Buffer.from(cookie.trim().substring(11), 'base64').toString('utf8')); } catch { return null; }
}

app.get('/', async (req, res) => {
    const code = req.query.code;
    if (code) {
        try {
            const tokenRes = await fetch('https://discord.com', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: getAppId(),
                    client_secret: (process.env.CLIENT_SECRET || '').trim(),
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: 'https://onrender.com'
                })
            });
            const tokenData = await tokenRes.json();
            if (!tokenData.access_token) return res.send('Discord Giris Hatasi: ' + JSON.stringify(tokenData));
            const user = await (await fetch('https://discord.com', { headers: { Authorization: `Bearer ${tokenData.access_token}` } })).json();
            const rawGuilds = await (await fetch('https://discord.com/guilds', { headers: { Authorization: `Bearer ${tokenData.access_token}` } })).json();
            const manageable = Array.isArray(rawGuilds) ? rawGuilds.filter(g => (BigInt(g.permissions) & 0x20n) === 0x20n || (BigInt(g.permissions) & 0x8n) === 0x8n).map(g => ({ id: g.id, name: g.name, icon: g.icon, owner: g.owner })) : [];
            const payload = Buffer.from(JSON.stringify({ user: { id: user.id, username: user.username, avatar: user.avatar }, guilds: manageable })).toString('base64');
            res.setHeader('Set-Cookie', `kreon_sess=${payload}; Path=/; HttpOnly; Max-Age=86400`);
            return res.redirect('/dashboard');
        } catch (e) { return res.send('Baglanti Hatasi: ' + e.message); }
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/dashboard', (req, res) => {
    if (!getSession(req)) return res.redirect('/login');
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/login', (req, res) => res.redirect(buildDiscordAuthUrl()));
app.get('/logout', (req, res) => { res.setHeader('Set-Cookie', 'kreon_sess=; Path=/; Max-Age=0'); res.redirect('/'); });
app.get('/api/me', (req, res) => { const s = getSession(req); if (!s) return res.status(401).json({ error: 'Giriş gerekli' }); res.json({ user: s.user, guilds: s.guilds.map(g => ({ ...g, botIn: client.guilds.cache.has(g.id) })) }); });
app.get('/api/guild/:id', async (req, res) => { const g = client.guilds.cache.get(req.params.id); if (!g) return res.status(404).json({ error: 'Yok' }); const channels = g.channels.cache.filter(c => c.type === ChannelType.GuildText).map(c => ({ id: c.id, name: c.name })); const roles = g.roles.cache.filter(r => !r.managed && r.id !== g.id).map(r => ({ id: r.id, name: r.name })); res.json({ settings: await getSettings(g.id), channels, roles }); });
app.post('/api/guild/:id', async (req, res) => { await saveSettings(req.params.id, req.body); res.json({ ok: true }); });
app.get('/invite', (req, res) => res.redirect(`https://discord.com?client_id=${getAppId()}&permissions=8&scope=bot%20applications.commands${req.query.guild_id ? '&guild_id=' + req.query.guild_id : ''}`));
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
