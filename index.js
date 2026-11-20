const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { Client, Collection, Events, GatewayIntentBits, ChannelType } = require('discord.js');
const { connectDB, getSettings, saveSettings, registerSystems } = require('./systems');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const clientId = '1569848116973277234';
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates] });

process.env.FFMPEG_PATH = require('ffmpeg-static'); const { Player } = require('discord-player'); const { DefaultExtractors } = require('@discord-player/extractor'); const player = new Player(client); (async () => { try { await player.extractors.loadMulti(DefaultExtractors); } catch (e) { console.log('Extractor uyarısı:', e.message); } })();
connectDB();
registerSystems(client);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

app.get('/api/me', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    await client.guilds.fetch().catch(() => {});
    const guilds = client.guilds.cache.map(g => ({ id: g.id, name: g.name, iconUrl: g.icon ? '/api/icon/' + g.id : null, botIn: true, owner: true }));
    res.json({ guilds });
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

app.post('/api/guild/:id', async (req, res) => {
    await saveSettings(req.params.id, req.body);
    res.json({ ok: true });
});

app.get('/api/stats', (req, res) => {
    res.json({ guilds: client.guilds.cache.size, users: client.guilds.cache.reduce((a, g) => a + (g.memberCount || 0), 0), ping: client.ws.ping > 0 ? client.ws.ping : 24 });
});

app.listen(port, () => console.log('🌐 Site ve Kontrol Paneli ' + port + ' portunda aktif.'));
client.commands = new Collection();
const slashData = [];
for (const folder of fs.readdirSync(path.join(__dirname, 'commands'))) {
    const p = path.join(__dirname, 'commands', folder);
    for (const file of fs.readdirSync(p).filter(f => f.endsWith('.js'))) {
        const mod = require(path.join(p, file));
        const list = Array.isArray(mod) ? mod : [mod];
        for (const c of list) {
            if (c && c.data && c.execute) {
                client.commands.set(c.data.name, c);
                slashData.push(c.data.toJSON());
            }
        }
    }
}

client.once(Events.ClientReady, async c => {
    console.log('✅ Kreon Bot aktif: ' + c.user.tag + ' | Yüklü komut: ' + client.commands.size);
    try { await c.application.commands.set(slashData); } catch (e) { console.error(e); }
});

client.on(Events.InteractionCreate, async i => {
    try {
        if (i.isButton() && i.customId === 'open_ticket') {
            const ch = await i.guild.channels.create({
                name: 'ticket-' + i.user.username,
                permissionOverwrites: [
                    { id: i.guild.id, deny: ['ViewChannel'] },
                    { id: i.user.id, allow: ['ViewChannel', 'SendMessages'] }
                ]
            });
            await ch.send('🎫 Hoş geldin <@' + i.user.id + '>, yetkililerimiz en kısa sürede ilgilenecektir!');
            return await i.reply({ content: '✅ Destek kanalın oluşturuldu: <#' + ch.id + '>', ephemeral: true });
        }
        if (!i.isChatInputCommand()) return;
        const cmd = client.commands.get(i.commandName);
        if (!cmd) return await i.reply({ content: '⚠️ Komut bulunamadı.', ephemeral: true });
        await cmd.execute(i);
    } catch (e) {
        console.error('Komut hatası:', e);
        if (!i.replied && !i.deferred) await i.reply({ content: '❌ Hata: ' + e.message, ephemeral: true }).catch(() => {});
    }
});

client.login(process.env.TOKEN);