const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const commands = [];
const foldersPath = path.join(__dirname, 'commands');
for (const folder of fs.readdirSync(foldersPath)) {
    const commandsPath = path.join(foldersPath, folder);
    for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
        const command = require(path.join(commandsPath, file));
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
        }
    }
}

const rest = new REST().setToken(process.env.TOKEN);
(async () => {
    try {
        console.log(`🔄 ${commands.length} global komut tüm sunucular için yükleniyor...`);
        const data = await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log(`✅ Başarıyla ${data.length} global komut yüklendi!`);
    } catch (error) {
        console.error(error);
    }
})();
