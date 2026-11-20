const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Kreon Bot 7/24 Aktif!'));
app.listen(port, () => console.log(`🌐 Web sunucusu ${port} portunda çalışıyor.`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();
const foldersPath = path.join(__dirname, 'commands');
for (const folder of fs.readdirSync(foldersPath)) {
    const commandsPath = path.join(foldersPath, folder);
    for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
        const command = require(path.join(commandsPath, file));
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        }
    }
}

const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

client.once(Events.ClientReady, c => {
    console.log(`✅ Kreon Bot aktif! Giriş yapıldı: ${c.user.tag} | Sunucu sayısı: ${c.guilds.cache.size}`);
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        const msg = { content: '❌ Komut çalıştırılırken hata oluştu!', ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
        else await interaction.reply(msg);
    }
});

client.login(process.env.TOKEN);
