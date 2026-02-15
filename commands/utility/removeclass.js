const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../../main')
const { safeReply } = require("../../helpers/safeReply")

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeclass')
    .setDescription('Remove a class')
    .addStringOption(opt => opt.setName('name').setDescription('Class to remove').setRequired(true).setAutocomplete(true)),

  async execute(interaction) {
    const guild = interaction.guild;
    const name = interaction.options.getString('name');

    try {
      const ref = db.collection(guild.id).doc(name);
      const snap = await ref.get();
      if (!snap.exists) return safeReply(interaction, 'Class not found!', true)

      const roleId = snap.data().roleId;
      const role = guild.roles.cache.get(roleId);
      if (role) await role.delete().catch(() => {});

      await ref.delete();

      // Remove class from all users
      const usersSnap = await db.collection('users').get();
      for (const userDoc of usersSnap.docs) {
        const guildRef = userDoc.ref.collection('guilds').doc(guild.id);
        const guildSnap = await guildRef.get();
        if (!guildSnap.exists) continue;

        const classes = guildSnap.data().classes || [];
        if (classes.includes(name)) {
          await guildRef.update({ classes: classes.filter(c => c !== name) });
        }
      }

      await safeReply(interaction, `Class **${name}** removed!`, true)
    } catch (err) {
      console.error(err);
    }
  },

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
};
