// Imports
const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { db } = require('../../main')
const { safeReply } = require("../../helpers/safeReply")

module.exports = {
  //Build Command
  data: new SlashCommandBuilder()
    .setName('addclass')
    .setDescription('Add a class')
    .addStringOption(opt => opt.setName('name').setDescription('Class name').setRequired(true)),

  // Command Function
  async execute(interaction) {
    const guild = interaction.guild;
    const name = interaction.options.getString('name');

    try {
      const ref = db.collection(guild.id).doc(name);
      if ((await ref.get()).exists) {
        return safeReply(interaction, `Class **${name}** already exists.`, true)
      }

      if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return safeReply(interaction, 'Bot lacks MANAGE_ROLES permission.', true)
      }

      const role = await guild.roles.create({ name });
      await ref.set({ roleId: role.id, createdAt: new Date() });

      await safeReply(interaction, `Class **${name}** added successfully.`, true)
    } catch (err) {
      console.error(err);
    }
  },
};
