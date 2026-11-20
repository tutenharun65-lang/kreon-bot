const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

const giveaways = new Map();

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('ai-sor')
      .setDescription('Kreon Yapay Zekâ asistanına istediğiniz soruyu sorun.')
      .addStringOption(o => o.setName('soru').setDescription('Yapay zekâya sormak istediğiniz soru').setRequired(true)),
    async execute(i) {
      await i.deferReply();
      const soru = i.options.getString('soru');
      try {
        const res = await fetch('https://pollinations.ai' + encodeURIComponent('Türkçe, kısa ve net cevap ver: ' + soru));
        const cevap = (await res.text()).slice(0, 1900);
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setAuthor({ name: 'Kreon AI Asistan', iconURL: i.client.user.displayAvatarURL() })
          .addFields(
            { name: '❓ Soru', value: soru.slice(0, 1000) },
            { name: '🤖 Cevap', value: cevap || 'Şu an yanıt üretilemedi, tekrar dene.' }
          );
        await i.editReply({ embeds: [embed] });
      } catch (e) {
        await i.editReply('❌ Yapay zekâ servisi şu an yoğun, biraz sonra tekrar dene.');
      }
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('çekiliş')
      .setDescription('Sunucuda butonlu otomatik çekiliş başlatır.')
      .addStringOption(o => o.setName('ödül').setDescription('Çekiliş ödülü').setRequired(true))
      .addIntegerOption(o => o.setName('dakika').setDescription('Kaç dakika sürecek?').setRequired(true).setMinValue(1).setMaxValue(10080))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(i) {
      const odul = i.options.getString('ödül');
      const dk = i.options.getInteger('dakika');
      const bitis = Math.floor((Date.now() + dk * 60000) / 1000);

      const embed = new EmbedBuilder()
        .setColor('#f59e0b')
        .setTitle('🎉 ÇEKİLİŞ BAŞLADI!')
        .setDescription(`🎁 **Ödül:** ${odul}\n⏰ **Bitiş:** <t:${bitis}:R>\n👥 **Katılımcı:** \`0\` kişi\n\nKatılmak için aşağıdaki **🎉 Çekilişe Katıl** butonuna tıklayın!`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('join_giveaway').setLabel('🎉 Çekilişe Katıl').setStyle(ButtonStyle.Success)
      );

      const msg = await i.reply({ embeds: [embed], components: [row], fetchReply: true });
      const users = new Set();
      giveaways.set(msg.id, { users, odul, channel: i.channel, msg });

      setTimeout(async () => {
        const gw = giveaways.get(msg.id);
        if (!gw) return;
        giveaways.delete(msg.id);
        const list = Array.from(gw.users);
        if (list.length === 0) {
          return gw.channel.send(`😢 **${gw.odul}** çekilişine kimse katılmadığı için kazanan seçilemedi.`).catch(() => {});
        }
        const winner = list[Math.floor(Math.random() * list.length)];
        await gw.channel.send(`🎊 Tebrikler <@${winner}>! **${gw.odul}** çekilişini kazandın!`).catch(() => {});
      }, dk * 60000);
    }
  }
];

module.exports.giveaways = giveaways;
