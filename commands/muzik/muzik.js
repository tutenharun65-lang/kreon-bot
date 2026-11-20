const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState, getVoiceConnection, StreamType } = require('@discordjs/voice');
const scdl = require('soundcloud-downloader').default;

const queues = new Map();

async function playNext(guildId) {
  const q = queues.get(guildId);
  if (!q || q.songs.length === 0) {
    if (q && q.conn) q.conn.destroy();
    queues.delete(guildId);
    return;
  }
  const song = q.songs.at(0);
  try {
    const stream = await scdl.download(song.url);
    const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
    q.player.play(resource);
  } catch (e) {
    console.error('Ses akış hatası:', e);
    if (q.textChannel) q.textChannel.send('⚠️ Şarkı akışı başlatılamadı: `' + e.message + '`').catch(() => {});
    q.songs.shift();
    playNext(guildId);
  }
}

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('oynat')
      .setDescription('Ses kanalına girer ve istediğiniz şarkıyı çalar.')
      .addStringOption(o => o.setName('şarkı').setDescription('Şarkı adı veya SoundCloud linki').setRequired(true)),
    async execute(i) {
      const vc = i.member.voice?.channel;
      if (!vc) return i.reply({ content: '🔊 Önce bir **ses kanalına** girmelisin!', ephemeral: true });
      await i.deferReply();

      try {
        const query = i.options.getString('şarkı');
        let track;
        if (scdl.isValidUrl(query)) {
          track = await scdl.getInfo(query);
        } else {
          const res = await scdl.search({ query, resourceType: 'tracks', limit: 1 });
          track = res.collection?.at(0);
        }
        if (!track) return i.editReply('❌ Aradığın şarkı bulunamadı!');

        let q = queues.get(i.guild.id);
        if (!q) {
          const player = createAudioPlayer();
          const conn = joinVoiceChannel({ channelId: vc.id, guildId: i.guild.id, adapterCreator: i.guild.voiceAdapterCreator, selfDeaf: true });
          await entersState(conn, VoiceConnectionStatus.Ready, 15000);
          conn.subscribe(player);
          q = { conn, player, songs: [], textChannel: i.channel };
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

        const sn = Math.floor((track.duration || 0) / 1000);
        const sure = sn > 0 ? `${Math.floor(sn / 60)}:${String(sn % 60).padStart(2, '0')}` : 'Canlı';
        const songInfo = { title: track.title, url: track.permalink_url, duration: sure, thumb: track.artwork_url };
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
        await i.editReply('❌ Hata oluştu: `' + e.message + '`');
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
