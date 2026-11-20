const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { Client, Collection, Events, GatewayIntentBits, ChannelType } = require('discord.js');
const { connectDB, getSettings, saveSettings, registerSystems } = require('./systems'); const mongoose = require('mongoose'); const SavedGuild = mongoose.models.SavedGuild || mongoose.model('SavedGuild', new mongoose.Schema({ guildId: String, name: String }));
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const clientId = '1569848116973277234';
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

connectDB();
registerSystems(client);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function getUserToken(req) {
    const c = (req.headers.cookie || '').split(';').find(x => x.trim().startsWith('k_tok='));
    return c ? c.trim().substring(6) : null;
}

app.get('/sync-servers', (req, res) => {
    const u = 'https://discord.com' + clientId + '&response_type=code&redirect_uri=' + encodeURIComponent('https://onrender.com') + '&scope=guilds';
    res.redirect(u);
});

app.get('/sync-callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/dashboard');
    try {
        const tr = await fetch('https://discord.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: clientId, client_secret: (process.env.CLIENT_SECRET || '').trim(), grant_type: 'authorization_code', code, redirect_uri: 'https://onrender.com' })
        });
        const td = await tr.json();
        if (td.access_token) {
            res.setHeader('Set-Cookie', 'k_tok=' + td.access_token + '; Path=/; HttpOnly; Max-Age=604800');
        }
    } catch {}
    res.redirect('/dashboard');
});

app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

app.get('/api/me', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    await client.guilds.fetch().catch(() => {});
    const botGuilds = new Map();
    client.guilds.cache.forEach(g => {
        botGuilds.set(g.id, { id: g.id, name: g.name, hasIcon: Boolean(g.icon), iconUrl: g.icon ? '/api/icon/' + g.id : null, botIn: true, owner: true });
    });

    const saved = mongoose.connection.readyState === 1 ? await SavedGuild.find().lean() : []; saved.forEach(sg => { if (!botGuilds.has(sg.guildId)) botGuilds.set(sg.guildId, { id: sg.guildId, name: sg.name, iconUrl: null, botIn: false, owner: true }); }); const tok = getUserToken(req);
    if (tok) {
        try {
            const ur = await fetch('https://discord.com', { headers: { Authorization: 'Bearer ' + tok } });
            const list = await ur.json();
            if (Array.isArray(list)) {
                list.forEach(g => {
                    const isAdmin = g.owner || (BigInt(g.permissions || 0) & 0x20n) === 0x20n || (BigInt(g.permissions || 0) & 0x8n) === 0x8n;
                    if (isAdmin && !botGuilds.has(g.id)) {
                        botGuilds.set(g.id, {
                            id: g.id,
                            name: g.name,
                            hasIcon: Boolean(g.icon),
                            iconUrl: g.icon ? '/api/ext-icon/' + g.id + '/' + g.icon : null,
                            botIn: false,
                            owner: Boolean(g.owner)
                        });
                    }
                });
            }
        } catch {}
    }

    const sorted = Array.from(botGuilds.values()).sort((a, b) => Number(b.botIn) - Number(a.botIn));
    res.json({ guilds: sorted, synced: Boolean(tok) });
});

app.get('/api/icon/:id', async (req, res) => {
    try {
        const g = client.guilds.cache.get(req.params.id);
        const url = g?.iconURL({ size: 128, extension: 'png', forceStatic: true });
        if (!url) return res.status(404).end();
        const r = await fetch(url);
        res.setHeader('Content-Type', 'image/png');
        res.send(Buffer.from(await r.arrayBuffer()));
    } catch { res.status(404).end(); }
});

app.get('/api/ext-icon/:id/:hash', async (req, res) => {
    try {
        const r = await fetch('https://discordapp.com' + req.params.id + '/' + req.params.hash + '.png?size=128');
        if (!r.ok) return res.status(404).end();
        res.setHeader('Content-Type', 'image/png');
        res.send(Buffer.from(await r.arrayBuffer()));
    } catch { res.status(404).end(); }
});

app.get('/api/bot-avatar', async (req, res) => {
    try {
        const u = client.user?.displayAvatarURL({ size: 128, extension: 'png', forceStatic: true });
        if (!u) return res.status(404).end();
        const r = await fetch(u);
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

app.post('/api/add-guild', async (req, res) => { const { name, guildId } = req.body; if (!name) return res.status(400).end(); const id = (guildId || '').replace(/\D/g, '') || ('manual_' + Date.now()); if (mongoose.connection.readyState === 1) await SavedGuild.findOneAndUpdate({ guildId: id }, { guildId: id, name }, { upsert: true }); res.json({ ok: true }); });
app.post('/api/guild/:id', async (req, res) => {
    await saveSettings(req.params.id, req.body);
    res.json({ ok: true });
});

app.get('/invite', (req, res) => {
    const g = req.query.guild_id ? '&guild_id=' + req.query.guild_id : '';
    res.redirect('https://discord.com' + clientId + '&permissions=8&scope=bot%20applications.commands' + g);
});

app.get('/api/stats', (req, res) => {
    res.json({ guilds: client.guilds.cache.size, users: client.guilds.cache.reduce((a, g) => a + (g.memberCount || 0), 0), ping: client.ws.ping > 0 ? client.ws.ping : 24 });
});

app.listen(port, () => console.log('?? Site ve Kontrol Paneli ' + port + ' portunda aktif.'));

client.commands = new Collection();
for (const folder of fs.readdirSync(path.join(__dirname, 'commands'))) {
    const p = path.join(__dirname, 'commands', folder);
    for (const file of fs.readdirSync(p).filter(f => f.endsWith('.js'))) {
        const c = require(path.join(p, file));
        if ('data' in c && 'execute' in c) client.commands.set(c.data.name, c);
    }
}

client.once(Events.ClientReady, c => console.log('? Kreon Bot aktif: ' + c.user.tag));
client.on(Events.InteractionCreate, async i => {
    if (!i.isChatInputCommand()) return;
    const c = client.commands.get(i.commandName);
    if (c) try { await c.execute(i); } catch (e) { console.error(e); }
});

client.login(process.env.TOKEN);
