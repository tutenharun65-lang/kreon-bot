const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', new mongoose.Schema({
  userId: String,
  coins: { type: Number, default: 0 },
  lastDaily: { type: Number, default: 0 },
  lastWork: { type: Number, default: 0 }
}));

async function getWallet(userId) {
  let w = await Wallet.findOne({ userId });
  if (!w) w = await Wallet.create({ userId, coins: 100 });
  return w;
}

module.exports = [
  {
    data: new SlashCommandBuilder().setName('bakiye').setDescription('Cüzdanınızdaki veya bir üyenin Kreon Coin bakiyesini gösterir.').addUserOption(o => o.setName('üye').setDescription('Bakiyesine bakılacak üye')),
    async execute(i) {
      const target = i.options.getUser('üye') || i.user;
      const w = await getWallet(target.id);
      const embed = new EmbedBuilder().setColor('#5865F2').setAuthor({ name: target.username, iconURL: target.displayAvatarURL() }).setDescription(`💰 **Cüzdan Bakiyesi:** \`${w.coins.toLocaleString('tr-TR')} Kreon Coin\``);
      await i.reply({ embeds: [embed] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('günlük').setDescription('24 saatte bir ücretsiz günlük Kreon Coin ödülünüzü alırsınız.'),
    async execute(i) {
      const w = await getWallet(i.user.id);
      const now = Date.now();
      if (now - w.lastDaily < 86400000) {
        const kalan = Math.ceil((86400000 - (now - w.lastDaily)) / 3600000);
        return i.reply({ content: `⏳ Günlük ödülünü zaten aldın! Tekrar almak için **${kalan} saat** beklemelisin.`, ephemeral: true });
      }
      const odul = Math.floor(Math.random() * 500) + 500;
      w.coins += odul;
      w.lastDaily = now;
      await w.save();
      await i.reply(`🎁 Günlük ödülün olan **${odul} Kreon Coin** cüzdanına eklendi! (Yeni bakiye: **${w.coins}**)`);
    }
  },
  {
    data: new SlashCommandBuilder().setName('çalış').setDescription('Çalışarak ekstra Kreon Coin kazanırsınız.'),
    async execute(i) {
      const w = await getWallet(i.user.id);
      const now = Date.now();
      if (now - w.lastWork < 1800000) {
        const dk = Math.ceil((1800000 - (now - w.lastWork)) / 60000);
        return i.reply({ content: `⏳ Dinlenmen gerekiyor! Tekrar çalışmak için **${dk} dakika** bekle.`, ephemeral: true });
      }
      const isler = ['yazılım geliştirdi', 'sunucu korudu', 'tasarım yaptı', 'ticaret yaptı'];
      const secilen = isler[Math.floor(Math.random() * isler.length)];
      const kazanc = Math.floor(Math.random() * 250) + 150;
      w.coins += kazanc;
      w.lastWork = now;
      await w.save();
      await i.reply(`💼 Bugün **${secilen}** ve **${kazanc} Kreon Coin** kazandın!`);
    }
  },
  {
    data: new SlashCommandBuilder().setName('gönder').setDescription('Başka bir üyeye Kreon Coin transfer edersiniz.').addUserOption(o => o.setName('üye').setDescription('Alıcı üye').setRequired(true)).addIntegerOption(o => o.setName('miktar').setDescription('Gönderilecek miktar').setRequired(true).setMinValue(1)),
    async execute(i) {
      const target = i.options.getUser('üye');
      const amount = i.options.getInteger('miktar');
      if (target.id === i.user.id || target.bot) return i.reply({ content: '❌ Kendine veya bir bota para gönderemezsin.', ephemeral: true });
      const sender = await getWallet(i.user.id);
      if (sender.coins < amount) return i.reply({ content: '❌ Cüzdanında yeterli Kreon Coin yok!', ephemeral: true });
      const receiver = await getWallet(target.id);
      sender.coins -= amount;
      receiver.coins += amount;
      await sender.save();
      await receiver.save();
      await i.reply(`💸 **${target.username}** adlı üyeye **${amount} Kreon Coin** gönderildi!`);
    }
  }
];
