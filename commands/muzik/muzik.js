const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState, getVoiceConnection, NoSubscriberBehavior } = require('@discordjs/voice');

const queues = new Map();

async function searchTrack(query) {
  try {
    const dz = await fetch('https://deezer.com' + encodeURIComponent(query));
    const dzData = await dz.json();
    const item = dzData.data && dzData.data.at(0);
    if (item && item.preview) {
      return { title: `${item.artist.name} - ${item.title}`, url: item.link, streamUrl: item.preview, duration: '0:30' };
    }
  } catch {}
  const au = await fetch('https://audius.co' + encodeURIComponent(query) + '&app_name=KreonBot');
  const auData = await au.json();
  const tr = auData.data && auData.data.at(0);
  if (tr) {
    return { title: tr.title, url: 'https://audius.co' + tr.permalink, streamUrl: `https://audius.co{tr.id}/stream?app_name=KreonBot`, duration: 'Tam Sürüm' };
  }
  return null;
}

function playNext(guildId) {
  const q = queues.get(guildId);
  if (!q || q.songs.length === 0) { if (q && q.conn) q.conn.destroy(); queues.delete(guildId); return; }
  const song = q.songs.at(0);
  q.player.play(createAudioResource(song.streamUrl));
}

module.exports = [
  {
    data: new SlashCommandBuilder().setName('oynat').setDescription('Ses kanalına girer ve şarkı çalar.').addStringOption(o => o.setName('şarkı').setDescription('Şarkı adı').setRequired(true)),
    async execute(i) {
      const vc = i.member.voice?.channel;
      if (!vc) return i.reply({ content: '🔊 Önce bir ses kanalına gir!', ephemeral: true });
      await i.reply('⏳ Odaya bağlanılıyor...');
      try {
        let q = queues.get(i.guild.id);
        if (!q) {
          const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
          const conn = joinVoiceChannel({ channelId: vc.id, guildId: i.guild.id, adapterCreator: i.guild.voiceAdapterCreator, selfDeaf: true });
          await entersState(conn, VoiceConnectionStatus.Ready, 15000);
          conn.subscribe(player);
          q = { conn, player, songs: [] };
          queues.set(i.guild.id, q);
          player.on(AudioPlayerStatus.Idle, () => { q.songs.shift(); playNext(i.guild.id); });
          player.on('error', e => { i.channel.send('⚠️ Ses hatası: ' + e.message).catch(() => {}); q.songs.shift(); playNext(i.guild.id); });
        }
        const songInfo = await searchTrack(i.options.getString('şarkı'));
        if (!songInfo) return i.editReply('❌ Şarkı bulunamadı!');
        q.songs.push(songInfo);
        if (q.songs.length === 1) {
          playNext(i.guild.id);
          await i.editReply({ content: '', embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🎵 Ses Kanalında Çalınıyor').setDescription(`**[${songInfo.title}](${songInfo.url})** (\`${songInfo.duration}\`)`)] });
        } else {
          await i.editReply(`🎶 Sıraya eklendi: **${songInfo.title}**`);
        }
      } catch (e) {
        await i.editReply('❌ Bağlantı hatası: `' + e.message + '`');
      }
    }
  },
  {
    data: new SlashCommandBuilder().setName('durdur').setDescription('Müziği durdurur ve odadan çıkar.'),
    async execute(i) {
      const q = queues.get(i.guild.id);
      if (q) { q.songs = []; q.conn.destroy(); queues.delete(i.guild.id); }
      else { const c = getVoiceConnection(i.guild.id); if (c) c.destroy(); }
      await i.reply('⏹️ Müzik durduruldu ve odadan çıkıldı.');
    }
  }
];
