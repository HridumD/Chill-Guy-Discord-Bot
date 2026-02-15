const { SlashCommandBuilder } = require('discord.js');
const { buildClassMenu } = require('../../helpers/buildClassMenu');
const { db } = require('../../main')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('myclasses')
    .setDescription('Manage your classes'),

  async execute(interaction) {
    const member = interaction.member;

    const userRef = db.collection('users').doc(member.id);
    await userRef.set({ createdAt: new Date() }, { merge: true });

    const guildRef = userRef.collection('guilds').doc(interaction.guild.id);
    const snap = await guildRef.get();
    const savedClasses = snap.exists ? snap.data().classes || [] : [];

    const menu = await buildClassMenu(db, interaction.guild.id, savedClasses);

    await interaction.deferReply({ ephemeral: true })
    await interaction.editReply({
      content: savedClasses.length
        ? 'Manage your classes:'
        : 'You have no classes selected yet.',
      components: [menu],
      ephemeral: true,
    });
  }
};
