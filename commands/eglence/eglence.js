const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = [
  {
    data: new SlashCommandBuilder().setName('avatar').setDescription('Kendinizin veya seçtiğiniz üyenin profil fotoğrafını büyütür.').addUserOption(o => o.setName('üye').setDescription('Profil fotoğrafına bakılacak üye')),
    async execute(i) {
      const u = i.options.getUser('üye') || i.user;
      const embed = new EmbedBuilder().setColor('#5865F2').setTitle(`🖼️ ${u.username} Avatarı`).setImage(u.displayAvatarURL({ size: 1024 }));
      await i.reply({ embeds: [embed] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('sunucu-bilgi').setDescription('Bulunduğunuz sunucunun detaylı istatistiklerini gösterir.'),
    async execute(i) {
      const g = i.guild;
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🏰 ${g.name} • Sunucu Bilgileri`)
        .setThumbnail(g.iconURL({ size: 256 }))
        .addFields(
          { name: '👑 Kurucu', value: `<@${g.ownerId}>`, inline: true },
          { name: '👥 Toplam Üye', value: `${g.memberCount}`, inline: true },
          { name: '💬 Kanal Sayısı', value: `${g.channels.cache.size}`, inline: true }
        );
      await i.reply({ embeds: [embed] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('ship').setDescription('İki üye arasındaki uyum yüzdesini ölçer.').addUserOption(o => o.setName('üye1').setDescription('Birinci üye').setRequired(true)).addUserOption(o => o.setName('üye2').setDescription('İkinci üye')),
    async execute(i) {
      const u1 = i.options.getUser('üye1');
      const u2 = i.options.getUser('üye2') || i.user;
      const yuzde = Math.floor(Math.random() * 101);
      const bar = '❤️'.repeat(Math.round(yuzde / 20)) + '🖤'.repeat(5 - Math.round(yuzde / 20));
      const embed = new EmbedBuilder().setColor('#ec4899').setTitle('💘 Aşk & Uyum Ölçer').setDescription(`**${u1.username}** 💕 **${u2.username}**\n\n${bar} **%${yuzde}**`);
      await i.reply({ embeds: [embed] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('istatistik').setDescription('Kreon Botun anlık gecikme ve sunucu istatistiklerini gösterir.'),
    async execute(i) {
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⚡ Kreon Bot • Canlı İstatistikler')
        .addFields(
          { name: '🌐 Sunucu Sayısı', value: `${i.client.guilds.cache.size}`, inline: true },
          { name: '👥 Kullanıcı Sayısı', value: `${i.client.guilds.cache.reduce((a, g) => a + (g.memberCount || 0), 0)}`, inline: true },
          { name: '📶 Gecikme (Ping)', value: `${i.client.ws.ping}ms`, inline: true }
        );
      await i.reply({ embeds: [embed] });
    }
  }
];
