const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const yts = require('yt-search');

const queues = new Map();

async function playNext(guildId) {
  const q = queues.get(guildId);
  if (!q || q.songs.length === 0) {
    if (q && q.conn) q.conn.destroy();
    queues.delete(guildId);
    return;
  }
  const song = q.songs[0];
  try {
    const stream = ytdl(song.url, { filter: 'audioonly', highWaterMark: 1 << 25, quality: 'highestaudio' });
    const resource = createAudioResource(stream);
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
      .addStringOption(o => o.setName('şarkı').setDescription('Şarkı adı veya YouTube linki').setRequired(true)),
    async execute(i) {
      const vc = i.member.voice?.channel;
      if (!vc) return i.reply({ content: '🔊 Önce bir **ses kanalına** girmelisin!', ephemeral: true });
      await i.deferReply();

      const query = i.options.getString('şarkı');
      let songInfo;
      if (ytdl.validateURL(query)) {
        const info = await ytdl.getBasicInfo(query);
        songInfo = { title: info.videoDetails.title, url: info.videoDetails.video_url, duration: info.videoDetails.lengthSeconds + ' sn', thumb: info.videoDetails.thumbnails[0]?.url };
      } else {
        const res = await yts(query);
        const v = res.videos[0];
        if (!v) return i.followUp('❌ Aradığın şarkı bulunamadı!');
        songInfo = { title: v.title, url: v.url, duration: v.timestamp, thumb: v.thumbnail };
      }

      let q = queues.get(i.guild.id);
      if (!q) {
        const player = createAudioPlayer();
        const conn = joinVoiceChannel({ channelId: vc.id, guildId: i.guild.id, adapterCreator: i.guild.voiceAdapterCreator });
        conn.subscribe(player);
        q = { conn, player, songs: [] };
        queues.set(i.guild.id, q);
        player.on(AudioPlayerStatus.Idle, () => {
          q.songs.shift();
          playNext(i.guild.id);
        });
      }

      q.songs.push(songInfo);
      if (q.songs.length === 1) {
        await playNext(i.guild.id);
        const embed = new EmbedBuilder().setColor('#5865F2').setTitle('🎵 Ses Kanalında Çalınıyor').setDescription(`**[${songInfo.title}](${songInfo.url})**\n⏱️ Süre: \`${songInfo.duration}\` • İsteyen: <@${i.user.id}>`).setThumbnail(songInfo.thumb);
        await i.followUp({ embeds: [embed] });
      } else {
        await i.followUp(`🎶 Sıraya eklendi (**#${q.songs.length}**): **${songInfo.title}**`);
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
