const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { db } = require('../../main')
const { safeReply } = require("../../helpers/safeReply")

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editclass')
    .setDescription('Rename a class and role')
    .addStringOption(opt =>
      opt.setName('oldname')
        .setDescription('Current class name')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(opt =>
      opt.setName('newname')
        .setDescription('New class name')
        .setRequired(true)
    ),

  async autocomplete(interaction) {
    const choices = []
    const focusedValue = interaction.options.getFocused(); 

    const guildRef = db.collection(interaction.guild.id)
    const snap = await guildRef.get()

   if (snap.empty) {
      console.log('No matching documents.');
      return;
    }  

    snap.forEach(doc => {
      choices.push(doc.id)
    });

		const filtered = choices.filter((choice) => choice.startsWith(focusedValue));
		await interaction.respond(filtered.map((choice) => ({ name: choice, value: choice })));
  },

  async execute(interaction) {
    const guild = interaction.guild;
    const oldName = interaction.options.getString('oldname');
    const newName = interaction.options.getString('newname');

    if (!oldName || !newName) {
      return interaction.reply({ content: 'Both old and new class names must be provided.', ephemeral: true });
    }

    try {
      const oldRef = db.collection(guild.id).doc(oldName);
      const snap = await oldRef.get();
      if (!snap.exists) return interaction.reply({ content: `Class **${oldName}** does not exist.`, ephemeral: true });

      const roleId = snap.data().roleId;
      const role = guild.roles.cache.get(roleId);
      if (!role) return interaction.reply({ content: 'Associated role not found.', ephemeral: true });

      // Update role name
      await role.setName(newName);

      // Create new document and delete old one
      await db.collection(guild.id).doc(newName).set({ roleId: role.id, updatedAt: new Date() });
      await oldRef.delete();

      // Update users collection
      const usersSnap = await db.collection('users').get();
      for (const userDoc of usersSnap.docs) {
        const guildRef = userDoc.ref.collection('guilds').doc(guild.id);
        const guildSnap = await guildRef.get();
        if (!guildSnap.exists) continue;

        const classes = guildSnap.data().classes || [];
        if (classes.includes(oldName)) {
          await guildRef.update({ classes: classes.map(c => c === oldName ? newName : c) });
        }
      }

      await interaction.reply({ content: `Class **${oldName}** renamed to **${newName}** successfully.` });
    } catch (err) {
      console.error('Error renaming class:', err);
      await interaction.reply({ content: 'An error occurred while renaming the class.', ephemeral: true });
    }
  },
};
