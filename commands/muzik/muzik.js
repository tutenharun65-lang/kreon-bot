const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLavalink, queues } = require('../../lavalink');

function playNext(guildId) {
  const q = queues.get(guildId);
  if (!q || q.songs.length === 0) {
    const sh = getLavalink();
    if (sh && sh.connections.has(guildId)) sh.leaveVoiceChannel(guildId).catch(() => {});
    queues.delete(guildId);
    return;
  }
  const song = q.songs.at(0);
  q.player.playTrack({ track: { encoded: song.encoded } }).catch(e => console.error('PlayTrack hatası:', e));
}

async function resolveBestTrack(node, rawQuery) {
  let query = rawQuery.trim();
  if (/youtube\.com|youtu\.be/.test(query)) {
    for (const api of [
      'https://noembed.com' + encodeURIComponent(query),
      'https://youtube.com' + encodeURIComponent(query)
    ]) {
      try {
        const r = await fetch(api);
        const d = await r.json();
        if (d && d.title) {
          query = d.title.replace(/\(.*?\)|\[.*?\]|official|video|audio|klip|lyrics|hd|4k/gi, '').replace(/\s+/g, ' ').trim();
          break;
        }
      } catch {}
    }
  }

  const shortTitle = query.split('-').at(-1).split('|').at(0).trim();
  const attempts = /^https?:\/\//.test(query) ? [query] : ['scsearch:' + query, 'scsearch:' + shortTitle];

  for (const s of attempts) {
    if (!s || s === 'scsearch:') continue;
    try {
      const res = await node.rest.resolve(s);
      if (res?.loadType === 'track') return res.data;
      if (res?.loadType === 'search' && res.data?.length) return res.data.at(0);
      if (res?.loadType === 'playlist' && res.data?.tracks?.length) return res.data.tracks.at(0);
    } catch {}
  }

  try {
    const au = await fetch('https://audius.co' + encodeURIComponent(shortTitle || query) + '&app_name=KreonBot');
    const auData = await au.json();
    const tr = auData.data && auData.data.at(0);
    if (tr) {
      const res = await node.rest.resolve(`https://audius.co{tr.id}/stream?app_name=KreonBot`);
      if (res?.loadType === 'track') {
        res.data.info.title = tr.title;
        res.data.info.uri = 'https://audius.co' + tr.permalink;
        return res.data;
      }
    }
  } catch {}

  try {
    const dz = await fetch('https://deezer.com' + encodeURIComponent(shortTitle || query));
    const dzData = await dz.json();
    const item = dzData.data && dzData.data.at(0);
    if (item && item.preview) {
      const res = await node.rest.resolve(item.preview);
      if (res?.loadType === 'track') {
        res.data.info.title = `${item.artist.name} - ${item.title}`;
        res.data.info.uri = item.link;
        return res.data;
      }
    }
  } catch {}

  return null;
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

        const track = await resolveBestTrack(node, i.options.getString('şarkı'));
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
      if (sh && sh.connections.has(i.guild.id)) await sh.leaveVoiceChannel(i.guild.id).catch(() => {});
      await i.reply('⏹️ Müzik durduruldu ve ses kanalından çıkıldı.');
    }
  }
];
