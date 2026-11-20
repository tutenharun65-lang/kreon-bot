const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = [
  {
    data: new SlashCommandBuilder().setName('yardım').setDescription('Kreon Bot komutlarını ve kontrol panelini gösterir.'),
    async execute(i) {
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⚡ Kreon Bot • Komut Menüsü')
        .setDescription('Sunucunuzu tek yerden y?netin!\n\n??? **Moderasyon:** `/ban`, `/kick`, `/temizle`, `/kilitle`, `/ticket-kur`\n?? **Ekonomi:** `/bakiye`, `/g?nl?k`, `/?al??`, `/g?nder`\n?? **Genel & E?lence:** `/rank`, `/avatar`, `/sunucu-bilgi`, `/ship`, `/istatistik`\n?? **Web Sitesi:** https://kreon-bot.onrender.com/');
      await i.reply({ embeds: [embed] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('temizle').setDescription('Belirtilen sayıda mesajı kanaldan siler.').addIntegerOption(o => o.setName('miktar').setDescription('Silinecek mesaj sayısı (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(i) {
      const m = i.options.getInteger('miktar');
      await i.channel.bulkDelete(m, true);
      await i.reply({ content: `🧹 **${m}** adet mesaj başarıyla temizlendi!`, ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('kilitle').setDescription('Bulunduğunuz kanalı üyelerin mesajlarına kapatır veya açar.').addBooleanOption(o => o.setName('durum').setDescription('Kilitlensin mi?').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(i) {
      const d = i.options.getBoolean('durum');
      await i.channel.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: !d });
      await i.reply(d ? '🔒 Kanal mesajlara **kilitlendi**.' : '🔓 Kanal kilidi **açıldı**.');
    }
  },
  {
    data: new SlashCommandBuilder().setName('ban').setDescription('Belirtilen üyeyi sunucudan yasaklar.').addUserOption(o => o.setName('üye').setDescription('Yasaklanacak kullanıcı').setRequired(true)).addStringOption(o => o.setName('sebep').setDescription('Yasaklama sebebi')).setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async execute(i) {
      const u = i.options.getUser('üye');
      const s = i.options.getString('sebep') || 'Sebep belirtilmedi';
      await i.guild.members.ban(u.id, { reason: s });
      await i.reply(`🔨 **${u.tag}** sunucudan yasaklandı. (**Sebep:** ${s})`);
    }
  },
  {
    data: new SlashCommandBuilder().setName('rank').setDescription('Sunucudaki aktiflik ve seviye kartınızı gösterir.'),
    async execute(i) {
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setAuthor({ name: i.user.username, iconURL: i.user.displayAvatarURL() })
        .setDescription('📊 **Seviye:** 1 • **XP:** 120 / 500\n💡 Sohbette aktif kalarak seviye atlayabilirsiniz!');
      await i.reply({ embeds: [embed] });
    }
  }
];
