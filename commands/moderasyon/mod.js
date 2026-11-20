const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = [
  {
    data: new SlashCommandBuilder().setName('kick').setDescription('Belirtilen üyeyi sunucudan atar.').addUserOption(o => o.setName('üye').setDescription('Atılacak üye').setRequired(true)).addStringOption(o => o.setName('sebep').setDescription('Atılma sebebi')).setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    async execute(i) {
      const m = i.options.getMember('üye');
      const s = i.options.getString('sebep') || 'Sebep belirtilmedi';
      if (!m || !m.kickable) return i.reply({ content: '❌ Bu üyeyi sunucudan atamıyorum.', ephemeral: true });
      await m.kick(s);
      await i.reply(`👢 **${m.user.tag}** sunucudan atıldı. (**Sebep:** ${s})`);
    }
  },
  {
    data: new SlashCommandBuilder().setName('ticket-kur').setDescription('Bulunduğunuz kanala butonlu destek (ticket) sistemi kurar.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(i) {
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎫 Kreon Bot • Destek Talebi Sistemi')
        .setDescription('Yetkili ekibimizle özel olarak görüşmek için aşağıdaki **Destek Talebi Aç** butonuna tıklayın.');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('open_ticket').setLabel('📩 Destek Talebi Aç').setStyle(ButtonStyle.Primary)
      );
      await i.channel.send({ embeds: [embed], components: [row] });
      await i.reply({ content: '✅ Ticket paneli bu kanala kuruldu!', ephemeral: true });
    }
  }
];
