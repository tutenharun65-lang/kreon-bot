const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { Client, Collection, Events, GatewayIntentBits, ChannelType } = require('discord.js');
const { connectDB, getSettings, saveSettings, registerSystems } = require('./systems');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const adminPass = process.env.ADMIN_PASS || 'kreon2026';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });
connectDB();
registerSystems(client);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function isAuth(req) { return true; }

app.use(express.static(path.join(__dirname, 'public')));

app.post('/admin-login', (req, res) => {
    if (req.body.password === adminPass) {
        res.setHeader('Set-Cookie', 'kreon_admin=ok; Path=/; HttpOnly; Max-Age=2592000');
        return res.redirect('/dashboard');
    }
    res.redirect('/dashboard?err=1');
});

app.get('/dashboard', (req, res) => {
    if (!isAuth(req)) {
        const err = req.query.err ? '<p style="color:#ef4444;font-size:14px">❌ Hatalı şifre!</p>' : '';
        return res.send(`<!DOCTYPE html><html><body style="background:#111218;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:14px"><h2>⚡ Kreon Bot Kontrol Paneli</h2><p style="color:#9ca3af">Yönetim paneline erişmek için yönetici şifresini girin.</p>${err}<form method="POST" action="/admin-login" style="display:flex;flex-direction:column;gap:10px;width:280px"><input type="password" name="password" placeholder="Yönetici Şifresi" required style="padding:12px;border-radius:8px;border:1px solid #2f3346;background:#181a24;color:#fff"><button type="submit" style="background:#5865F2;color:#fff;padding:12px;border-radius:8px;border:none;font-weight:bold;cursor:pointer">Panele Gir</button></form></body></html>`);
    }
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/logout', (req, res) => { res.setHeader('Set-Cookie', 'kreon_admin=; Path=/; Max-Age=0'); res.redirect('/'); });
app.get('/api/me', (req, res) => {
    if (!isAuth(req)) return res.status(401).json({ error: 'Giriş gerekli' });
    const guilds = client.guilds.cache.map(g => ({ id: g.id, name: g.name, icon: g.iconURL({ size: 128, extension: 'png' }), owner: true, botIn: true }));
    res.json({ user: { id: client.user?.id || '0', username: 'Kreon Yönetici', avatar: client.user?.avatar || null }, guilds });
});
app.get('/api/guild/:id', async (req, res) => { const g = client.guilds.cache.get(req.params.id); if (!g) return res.status(404).json({ error: 'Yok' }); const channels = g.channels.cache.filter(c => c.type === ChannelType.GuildText).map(c => ({ id: c.id, name: c.name })); const roles = g.roles.cache.filter(r => !r.managed && r.id !== g.id).map(r => ({ id: r.id, name: r.name })); res.json({ settings: await getSettings(g.id), channels, roles }); });
app.post('/api/guild/:id', async (req, res) => { await saveSettings(req.params.id, req.body); res.json({ ok: true }); });
app.get('/invite', (req, res) => res.redirect(`https://discord.com{client.user?.id || '1569848116973277234'}&permissions=8&scope=bot%20applications.commands${req.query.guild_id ? '&guild_id=' + req.query.guild_id : ''}`));
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


