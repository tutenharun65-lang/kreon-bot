const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [];
const foldersPath = path.join(__dirname, 'commands');

for (const folder of fs.readdirSync(foldersPath)) {
    const commandsPath = path.join(foldersPath, folder);
    for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
        const mod = require(path.join(commandsPath, file));
        const list = Array.isArray(mod) ? mod : [mod];
        for (const cmd of list) {
            if ('data' in cmd && 'execute' in cmd) {
                commands.push(cmd.data.toJSON());
            }
        }
    }
}

const rest = new REST().setToken(process.env.TOKEN);

(async () => {
    try {
        console.log(`🔄 ${commands.length} adet Slash (/) komutu Discord'a yükleniyor...`);
        const appId = (process.env.CLIENT_ID || '').replace(/\D/g, '') || '1569848116973277234';
        const data = await rest.put(Routes.applicationCommands(appId), { body: commands });
        console.log(`✅ Başarılı! ${data.length} adet komut Discord profiline ve sunuculara yüklendi.`);
    } catch (error) {
        console.error('❌ Komut yükleme hatası:', error);
    }
})();
