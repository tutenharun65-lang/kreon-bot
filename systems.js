const mongoose = require('mongoose');
const { Events, AuditLogEvent, PermissionsBitField } = require('discord.js');

const GuildModel = mongoose.model('GuildSettings', new mongoose.Schema({ guildId: { type: String, unique: true }, settings: { type: Object, default: {} } }));
const UserModel = mongoose.model('UserData', new mongoose.Schema({ guildId: String, userId: String, xp: { type: Number, default: 0 }, level: { type: Number, default: 1 }, coins: { type: Number, default: 0 }, lastDaily: { type: Number, default: 0 } }));
const memoryCache = new Map();

async function connectDB() {
    if (!process.env.MONGO_URI) return console.log('⚠️ MONGO_URI eksik!');
    try { await mongoose.connect(process.env.MONGO_URI); console.log('✅ MongoDB kalici veritabanina baglanildi!'); } catch (e) { console.error('MongoDB Hatasi:', e.message); }
}

async function getSettings(guildId) {
    if (mongoose.connection.readyState === 1) { const doc = await GuildModel.findOne({ guildId }); return doc ? doc.settings : {}; }
    return memoryCache.get(guildId) || {};
}

async function saveSettings(guildId, settings) {
    memoryCache.set(guildId, settings);
    if (mongoose.connection.readyState === 1) await GuildModel.findOneAndUpdate({ guildId }, { settings }, { upsert: true });
}

function registerSystems(client) {
    client.on(Events.GuildMemberAdd, async member => {
        const s = await getSettings(member.guild.id);
        if (member.user.bot && s.guardBot) {
            const logs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 1 }).catch(() => null);
            const exec = logs?.entries.first()?.executor;
            if (exec && exec.id !== member.guild.ownerId) {
                await member.kick('Kreon Anti-Bot Guard').catch(() => {});
                if (s.guardLogChannel) member.guild.channels.cache.get(s.guardLogChannel)?.send(`🚨 **Anti-Bot Guard:** ${exec.tag} tarafından eklenen **${member.user.tag}** botu atıldı!`);
            }
            return;
        }
        if (s.autoRole) { const role = member.guild.roles.cache.get(s.autoRole); if (role) await member.roles.add(role).catch(() => {}); }
        if (s.welcomeChannel) {
            const ch = member.guild.channels.cache.get(s.welcomeChannel);
            if (ch) ch.send((s.welcomeMessage || 'Hoş geldin {user}! Seninle birlikte **{count}** kişi olduk.').replace('{user}', `<@${member.id}>`).replace('{count}', member.guild.memberCount)).catch(() => {});
        }
    });

    const swears = ['amk', 'aq', 'oc', 'oç', 'sik', 'yarrak', 'orospu', 'piç'];
    client.on(Events.MessageCreate, async message => {
        if (!message.guild || message.author.bot) return;
        const s = await getSettings(message.guild.id);
        if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            const txt = message.content.toLowerCase();
            if (s.antiLink && /(discord\.gg\/|discord\.com\/invite\/|http:\/\/|https:\/\/)/i.test(txt)) { await message.delete().catch(() => {}); return message.channel.send(`⚠️ <@${message.author.id}>, reklam ve link paylaşımı yasaktır!`).then(m => setTimeout(() => m.delete().catch(() => {}), 4000)); }
            if (s.antiSwear && swears.some(w => txt.split(/\s+/).includes(w))) { await message.delete().catch(() => {}); return message.channel.send(`⚠️ <@${message.author.id}>, lütfen argo ve küfür kullanmayalım!`).then(m => setTimeout(() => m.delete().catch(() => {}), 4000)); }
            if (s.antiCaps && message.content.length >= 10 && message.content === message.content.toUpperCase() && /[A-ZÇĞİÖŞÜ]/.test(message.content)) { await message.delete().catch(() => {}); return message.channel.send(`⚠️ <@${message.author.id}>, lütfen büyük harf (Caps-Lock) kullanmayalım!`).then(m => setTimeout(() => m.delete().catch(() => {}), 4000)); }
        }
        if (s.leveling && mongoose.connection.readyState === 1) {
            let u = await UserModel.findOne({ guildId: message.guild.id, userId: message.author.id }) || await UserModel.create({ guildId: message.guild.id, userId: message.author.id });
            u.xp += Math.floor(Math.random() * 10) + 10;
            if (u.xp >= u.level * 150) { u.level += 1; u.xp = 0; message.channel.send(`🎉 Tebrikler <@${message.author.id}>, **${u.level}. seviyeye** ulaştın!`).catch(() => {}); }
            await u.save();
        }
    });

    client.on(Events.ChannelDelete, async ch => {
        if (!ch.guild) return;
        const s = await getSettings(ch.guild.id);
        if (!s.guardChannel) return;
        const exec = (await ch.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 1 }).catch(() => null))?.entries.first()?.executor;
        if (exec && exec.id !== ch.guild.ownerId && exec.id !== client.user.id) {
            const m = await ch.guild.members.fetch(exec.id).catch(() => null);
            if (m) await m.roles.set([]).catch(() => {});
            if (s.guardLogChannel) ch.guild.channels.cache.get(s.guardLogChannel)?.send(`🚨 **Anti-Nuke Kanal Guard:** **${exec.tag}** izinsiz kanal sildiği için yetkileri alındı!`);
        }
    });

    client.on(Events.RoleDelete, async role => {
        const s = await getSettings(role.guild.id);
        if (!s.guardRole) return;
        const exec = (await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 1 }).catch(() => null))?.entries.first()?.executor;
        if (exec && exec.id !== role.guild.ownerId && exec.id !== client.user.id) {
            const m = await role.guild.members.fetch(exec.id).catch(() => null);
            if (m) await m.roles.set([]).catch(() => {});
            if (s.guardLogChannel) role.guild.channels.cache.get(s.guardLogChannel)?.send(`🚨 **Anti-Nuke Rol Guard:** **${exec.tag}** izinsiz rol sildiği için yetkileri alındı!`);
        }
    });
}
module.exports = { connectDB, getSettings, saveSettings, registerSystems, UserModel };
