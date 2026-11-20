const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Kreon Bot gecikme süresini ve durumunu gösterir.'),
    async execute(interaction) {
        await interaction.reply(`🏓 Pong! Kreon Bot aktif | Gecikme: **${interaction.client.ws.ping}ms**`);
    },
};
