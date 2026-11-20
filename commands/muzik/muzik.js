const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState, getVoiceConnection, NoSubscriberBehavior } = require('@discordjs/voice');
const { Readable } = require('node:stream');

const queues = new Map();

async function searchTrack(query) {
  try {
    const dz = await fetch('https://deezer.com' + encodeURIComponent(query));
    const dzData = await dz.json();
    const item = dzData.data && dzData.data.at(0);
    if (item && item.preview) {
      return {
        title: `${item.artist.name} - ${item.title}`,
        url: item.link,
        streamUrl: item.preview,
        duration: '0:30 (Önizleme)',
        thumb: item.album?.cover_medium || null
      };
    }
  } catch {}

  const au = await fetch('https://audius.co' + encodeURIComponent(query) + '&app_name=KreonBot');
  const auData = await au.json();
  const tr = auData.data && auData.data.at(0);
  if (tr) {
    const sn = tr.duration || 0;
    return {
      title: tr.title,
      url: 'https://audius.co' + tr.permalink,
      streamUrl: `https://audius.co{tr.id}/stream?app_name=KreonBot`,
      duration: `${Math.floor(sn / 60)}:${String(sn % 60).padStart(2, '0')}`,
      thumb: tr.artwork?.['480x480'] || null
    };
  }
  return null;
}

async function playNext(guildId) {
  const q = queues.get(guildId);
  if (!q || q.songs.length === 0) {
    if (q && q.conn) q.conn.destroy();
    queues.delete(guildId);
    return;
  }
  const song = q.songs.at(0);
  try {
    const audioRes = await fetch(song.streamUrl);
    const nodeStream = Readable.fromWeb(audioRes.body);
    const resource = createAudioResource(nodeStream);
    q.player.play(resource);
  } catch (e) {
    console.error('Akış hatası:', e);
    q.songs.shift();
    playNext(guildId);
  }
}

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('oynat')
      .setDescription('Ses kanalına girer ve istediğiniz şarkıyı çalar.')
      .addStringOption(o => o.setName('şarkı').setDescription('Şarkı adı').setRequired(true)),
    async execute(i) {
      const vc = i.member.voice?.channel;
      if (!vc) return i.reply({ content: '🔊 Önce bir **ses kanalına** girmelisin!', ephemeral: true });
      await i.deferReply();

      try {
        const query = i.options.getString('şarkı');
        const songInfo = await searchTrack(query);
        if (!songInfo) return i.editReply('❌ Aradığın şarkı bulunamadı!');

        let q = queues.get(i.guild.id);
        if (!q) {
          const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
          const conn = joinVoiceChannel({
            channelId: vc.id,
            guildId: i.guild.id,
            adapterCreator: i.guild.voiceAdapterCreator,
            selfDeaf: true
          });
          await entersState(conn, VoiceConnectionStatus.Ready, 15000);
          conn.subscribe(player);
          q = { conn, player, songs: [] };
          queues.set(i.guild.id, q);
          player.on(AudioPlayerStatus.Idle, () => {
            q.songs.shift();
            playNext(i.guild.id);
          });
          player.on('error', err => {
            console.error('Player hatası:', err);
            q.songs.shift();
            playNext(i.guild.id);
          });
        }

        q.songs.push(songInfo);
        if (q.songs.length === 1) {
          await playNext(i.guild.id);
          const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎵 Ses Kanalında Çalınıyor')
            .setDescription(`**[${songInfo.title}](${songInfo.url})**\n⏱️ Süre: \`${songInfo.duration}\` • İsteyen: <@${i.user.id}>`)
            .setThumbnail(songInfo.thumb);
          await i.editReply({ embeds: [embed] });
        } else {
          await i.editReply(`🎶 Sıraya eklendi (**#${q.songs.length}**): **${songInfo.title}**`);
        }
      } catch (e) {
        await i.editReply('❌ Ses hatası: `' + e.message + '`');
      }
    }
  },
  {
    data: new SlashCommandBuilder().setName('atla').setDescription('Çalan şarkıyı atlar.'),
    async execute(i) {
      const q = queues.get(i.guild.id);
      if (!q) return i.reply({ content: '❌ Şu an çalan bir şarkı yok.', ephemeral: true });
      q.player.stop();
      await i.reply('⏭️ Şarkı atlandı!');
    }
  },
  {
    data: new SlashCommandBuilder().setName('durdur').setDescription('Müziği durdurur ve bot ses kanalından çıkar.'),
    async execute(i) {
      const q = queues.get(i.guild.id);
      if (q) { q.songs = []; q.conn.destroy(); queues.delete(i.guild.id); }
      else { const c = getVoiceConnection(i.guild.id); if (c) c.destroy(); }
      await i.reply('⏹️ Müzik durduruldu ve ses kanalından çıkıldı.');
    }
  },
  {
    data: new SlashCommandBuilder().setName('sıra').setDescription('Çalma sırasındaki şarkıları gösterir.'),
    async execute(i) {
      const q = queues.get(i.guild.id);
      if (!q || q.songs.length === 0) return i.reply({ content: '📭 Sıra şu an boş.', ephemeral: true });
      const list = q.songs.map((s, idx) => `**${idx + 1}.** ${s.title} (\`${s.duration}\`)`).join('\n');
      await i.reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🎶 Müzik Sırası').setDescription(list)] });
    }
  }
];
