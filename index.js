const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/invite', (req, res) => {
    const clientId = process.env.CLIENT_ID || '1569848116973277234';
    res.redirect(`https://discord.com{clientId}&permissions=8&scope=bot%20applications.commands`);
});
app.get('/api/stats', (req, res) => {
    const users = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);
    res.json({ guilds: client.guilds.cache.size, users, ping: client.ws.ping > 0 ? client.ws.ping : 24 });
});
app.listen(port, () => console.log(`🌐 Web sitesi ${port} portunda çalışıyor.`));

client.commands = new Collection();
for (const folder of fs.readdirSync(path.join(__dirname, 'commands'))) {
    const commandsPath = path.join(__dirname, 'commands', folder);
    for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
        const command = require(path.join(commandsPath, file));
        if ('data' in command && 'execute' in command) client.commands.set(command.data.name, command);
    }
}

client.once(Events.ClientReady, c => console.log(`✅ Kreon Bot aktif: ${c.user.tag}`));
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try { await command.execute(interaction); } catch (e) { console.error(e); }
});
client.login(process.env.TOKEN);
