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
app.use(express.static(path.join(__dirname, 'public')));

app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

app.get('/api/me', (req, res) => {
    const guilds = client.guilds.cache.map(g => ({ id: g.id, name: g.name, hasIcon: Boolean(g.icon) }));
    res.json({ guilds });
});

app.get('/api/icon/:id', async (req, res) => {
    try {
        const g = client.guilds.cache.get(req.params.id);
        const url = g?.iconURL({ size: 128, extension: 'png', forceStatic: true });
        if (!url) return res.status(404).end();
        const r = await fetch(url);
        if (!r.ok) return res.status(404).end();
        res.setHeader('Content-Type', 'image/png');
        res.send(Buffer.from(await r.arrayBuffer()));
    } catch { res.status(404).end(); }
});

app.get('/api/guild/:id', async (req, res) => {
    const g = client.guilds.cache.get(req.params.id);
    if (!g) return res.status(404).json({ error: 'Yok' });
    const channels = g.channels.cache.filter(c => c.type === ChannelType.GuildText).map(c => ({ id: c.id, name: c.name }));
    const roles = g.roles.cache.filter(r => !r.managed && r.id !== g.id).map(r => ({ id: r.id, name: r.name }));
    res.json({ settings: await getSettings(g.id), channels, roles });
});

app.post('/api/guild/:id', async (req, res) => {
    await saveSettings(req.params.id, req.body);
    res.json({ ok: true });
});

app.get('/invite', (req, res) => {
    const id = client.user?.id || '1569848116973277234';
    res.redirect(`https://discord.com{id}&permissions=8&scope=bot%20applications.commands`);
});

app.get('/api/bot-avatar', async (req, res) => { try { const u = client.user?.displayAvatarURL({ size: 128, extension: 'png', forceStatic: true }); if (!u) return res.status(404).end(); const r = await fetch(u); res.setHeader('Content-Type', 'image/png'); res.send(Buffer.from(await r.arrayBuffer())); } catch { res.status(404).end(); } });
app.get('/api/stats', (req, res) => {
    res.json({ guilds: client.guilds.cache.size, users: client.guilds.cache.reduce((a, g) => a + (g.memberCount || 0), 0), ping: client.ws.ping > 0 ? client.ws.ping : 24 });
});

app.listen(port, () => console.log(`🌐 Site ve Kontrol Paneli ${port} portunda aktif.`));

client.commands = new Collection();
for (const folder of fs.readdirSync(path.join(__dirname, 'commands'))) {
    const p = path.join(__dirname, 'commands', folder);
    for (const file of fs.readdirSync(p).filter(f => f.endsWith('.js'))) {
        const c = require(path.join(p, file));
        if ('data' in c && 'execute' in c) client.commands.set(c.data.name, c);
    }
}

client.once(Events.ClientReady, c => console.log(`✅ Kreon Bot aktif: ${c.user.tag}`));
client.on(Events.InteractionCreate, async i => {
    if (!i.isChatInputCommand()) return;
    const c = client.commands.get(i.commandName);
    if (c) try { await c.execute(i); } catch (e) { console.error(e); }
});

client.login(process.env.TOKEN);

