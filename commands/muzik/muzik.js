const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState, getVoiceConnection } = require('@discordjs/voice');
const play = require('play-dl');

const queues = new Map();
let scReady = false;

async function ensureSoundCloud() {
  if (scReady) return;
  const cid = await play.getFreeClientID();
  await play.setToken({ soundcloud: { client_id: cid } });
  scReady = true;
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
    await ensureSoundCloud();
    const s = await play.stream(song.url);
    const resource = createAudioResource(s.stream, { inputType: s.type });
    q.player.play(resource);
  } catch (e) {
    console.error('Ses akış hatası:', e);
    q.songs.shift();
    playNext(guildId);
  }
}

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('oynat')
      .setDescription('Ses kanalına girer ve istediğiniz şarkıyı çalar.')
      .addStringOption(o => o.setName('şarkı').setDescription('Şarkı adı veya linki').setRequired(true)),
    async execute(i) {
      const vc = i.member.voice?.channel;
      if (!vc) return i.reply({ content: '🔊 Önce bir **ses kanalına** girmelisin!', ephemeral: true });
      await i.deferReply();

      try {
        await ensureSoundCloud();
        const query = i.options.getString('şarkı');
        const results = await play.search(query, { source: { soundcloud: 'tracks' }, limit: 1 });
        const track = results.at(0);
        if (!track) return i.editReply('❌ Aradığın şarkı bulunamadı!');

        let q = queues.get(i.guild.id);
        if (!q) {
          const player = createAudioPlayer();
          const conn = joinVoiceChannel({ channelId: vc.id, guildId: i.guild.id, adapterCreator: i.guild.voiceAdapterCreator, selfDeaf: true });
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

        const songInfo = { title: track.name, url: track.url, duration: track.durationRaw || 'Canlı', thumb: track.thumbnail };
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
        await i.editReply('❌ Müzik başlatılamadı: `' + e.message + '`');
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
