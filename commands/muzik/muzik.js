const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { useMainPlayer, useQueue } = require('discord-player');

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('oynat')
      .setDescription('Ses kanalında şarkı veya çalma listesi oynatır.')
      .addStringOption(o => o.setName('şarkı').setDescription('Şarkı adı veya linki').setRequired(true)),
    async execute(i) {
      const channel = i.member.voice?.channel;
      if (!channel) return i.reply({ content: '🔊 Önce bir **ses kanalına** girmelisin!', ephemeral: true });
      await i.deferReply();
      const query = i.options.getString('şarkı');
      const player = useMainPlayer();
      try {
        const { track } = await player.play(channel, query, {
          nodeOptions: { metadata: i, leaveOnEmpty: true, leaveOnEmptyCooldown: 60000, leaveOnEnd: true }
        });
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('🎵 Çalınıyor / Sıraya Eklendi')
          .setDescription(`**[${track.title}](${track.url})**\n⏱️ Süre: \`${track.duration}\` • İsteyen: <@${i.user.id}>`)
          .setThumbnail(track.thumbnail);
        await i.followUp({ embeds: [embed] });
      } catch (e) {
        await i.followUp('❌ Şarkı bulunamadı veya oynatılamadı: `' + e.message + '`');
      }
    }
  },
  {
    data: new SlashCommandBuilder().setName('atla').setDescription('Çalan şarkıyı atlayıp sıradaki şarkıya geçer.'),
    async execute(i) {
      const queue = useQueue(i.guild.id);
      if (!queue || !queue.isPlaying()) return i.reply({ content: '❌ Şu an çalan bir şarkı yok.', ephemeral: true });
      queue.node.skip();
      await i.reply('⏭️ Şarkı atlandı!');
    }
  },
  {
    data: new SlashCommandBuilder().setName('durdur').setDescription('Müziği tamamen durdurur ve bot ses kanalından çıkar.'),
    async execute(i) {
      const queue = useQueue(i.guild.id);
      if (!queue) return i.reply({ content: '❌ Aktif bir müzik sırası yok.', ephemeral: true });
      queue.delete();
      await i.reply('⏹️ Müzik durduruldu ve kanaldan çıkıldı.');
    }
  },
  {
    data: new SlashCommandBuilder().setName('sıra').setDescription('Müzik sırasındaki şarkıları listeler.'),
    async execute(i) {
      const queue = useQueue(i.guild.id);
      if (!queue || !queue.currentTrack) return i.reply({ content: '📭 Sıra şu an boş.', ephemeral: true });
      const list = queue.tracks.toArray().slice(0, 10).map((t, idx) => `**${idx + 1}.** ${t.title} (\`${t.duration}\`)`).join('\n') || 'Sırada bekleyen başka şarkı yok.';
      const embed = new EmbedBuilder().setColor('#5865F2').setTitle('🎶 Müzik Sırası').setDescription(`▶️ **Şu An Çalan:** ${queue.currentTrack.title}\n\n${list}`);
      await i.reply({ embeds: [embed] });
    }
  }
];
