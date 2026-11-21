const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLavalink, queues } = require('../../lavalink');

function playNext(guildId) {
  const q = queues.get(guildId);
  if (!q || q.songs.length === 0) {
    const sh = getLavalink();
    if (sh) sh.leaveVoiceChannel(guildId).catch(() => {});
    queues.delete(guildId);
    return;
  }
  const song = q.songs.at(0);
  q.player.playTrack({ track: { encoded: song.encoded } }).catch(e => console.error('PlayTrack hatası:', e));
}

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('oynat')
      .setDescription('Şarkı adı veya YouTube/SoundCloud linki ile müzik çalar.')
      .addStringOption(o => o.setName('şarkı').setDescription('Şarkı adı veya YouTube/SoundCloud linki').setRequired(true)),
    async execute(i) {
      const vc = i.member.voice?.channel;
      if (!vc) return i.reply({ content: '🔊 Önce bir **ses kanalına** girmelisin!', ephemeral: true });
      await i.deferReply();

      try {
        const sh = getLavalink();
        const node = sh && sh.options.nodeResolver(sh.nodes);
        if (!node) return i.editReply('⏳ Ses sunucusu şu an uyanıyor, 5 saniye bekleyip tekrar `/oynat` yaz!');

        let query = i.options.getString('şarkı');
        if (/youtube\.com|youtu\.be/.test(query)) {
          try {
            const ytRes = await fetch('https://youtube.com' + encodeURIComponent(query));
            const ytData = await ytRes.json();
            if (ytData && ytData.title) query = ytData.title;
          } catch {}
        }

        const searchStr = /^https?:\/\//.test(query) ? query : 'scsearch:' + query;
        const res = await node.rest.resolve(searchStr);

        let track = null;
        if (res?.loadType === 'track') track = res.data;
        else if (res?.loadType === 'search') track = res.data.at(0);
        else if (res?.loadType === 'playlist') track = res.data.tracks.at(0);

        if (!track) return i.editReply('❌ Aradığın şarkı bulunamadı!');

        const sn = Math.floor((track.info.length || 0) / 1000);
        const sure = sn > 0 ? `${Math.floor(sn / 60)}:${String(sn % 60).padStart(2, '0')}` : 'Canlı';
        const songInfo = { title: track.info.title, url: track.info.uri, encoded: track.encoded, duration: sure, thumb: track.info.artworkUrl };

        let q = queues.get(i.guild.id);
        if (!q || !sh.players.has(i.guild.id)) {
          if (sh.connections.has(i.guild.id)) await sh.leaveVoiceChannel(i.guild.id).catch(() => {});
          const player = await sh.joinVoiceChannel({ guildId: i.guild.id, channelId: vc.id, shardId: 0, deaf: true });
          q = { player, songs: [songInfo] };
          queues.set(i.guild.id, q);
          player.on('end', () => {
            q.songs.shift();
            playNext(i.guild.id);
          });
          player.on('closed', () => {
            queues.delete(i.guild.id);
          });

          const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎵 Ses Kanalında Çalınıyor')
            .setDescription(`**[${songInfo.title}](${songInfo.url})**\n⏱️ Süre: \`${songInfo.duration}\` • İsteyen: <@${i.user.id}>`)
            .setThumbnail(songInfo.thumb);
          await i.editReply({ embeds: [embed] });
          playNext(i.guild.id);
        } else {
          q.songs.push(songInfo);
          await i.editReply(`🎶 Sıraya eklendi (**#${q.songs.length}**): **${songInfo.title}**`);
        }
      } catch (e) {
        queues.delete(i.guild.id);
        await i.editReply('❌ Bağlantı yenilendi, tekrar `/oynat` yaz! (`' + e.message + '`)').catch(() => {});
      }
    }
  },
  {
    data: new SlashCommandBuilder().setName('atla').setDescription('Çalan şarkıyı atlar.'),
    async execute(i) {
      const q = queues.get(i.guild.id);
      if (!q) return i.reply({ content: '❌ Şu an çalan bir şarkı yok.', ephemeral: true });
      await q.player.stopTrack();
      await i.reply('⏭️ Şarkı atlandı!');
    }
  },
  {
    data: new SlashCommandBuilder().setName('durdur').setDescription('Müziği durdurur ve bot odadan çıkar.'),
    async execute(i) {
      const q = queues.get(i.guild.id);
      if (q) { q.songs = []; await q.player.stopTrack().catch(() => {}); queues.delete(i.guild.id); }
      const sh = getLavalink();
      if (sh) await sh.leaveVoiceChannel(i.guild.id).catch(() => {});
      await i.reply('⏹️ Müzik durduruldu ve ses kanalından çıkıldı.');
    }
  }
];
