const { Events, MessageFlags } = require('discord.js');
const { db } = require('../main')
const { buildClassMenu } = require('../helpers/buildClassMenu');
const { safeReply } = require('../helpers/safeReply');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		// Command Interaction
		if (interaction.isChatInputCommand()) {
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}

			try {
				await command.execute(interaction);
			} catch (error) {
				console.error(error);
			}
		// Autocomplete Interaction
		} else if (interaction.isAutocomplete()) {
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}

			try {
				await command.autocomplete(interaction);
			} catch (error) {
				console.error(error);
			}
		//Select Menu Interaction
		} else if (interaction.isStringSelectMenu()) {
			if (interaction.customId !== 'class_select') return;

			await interaction.deferUpdate();

			const member = interaction.member;
			const selected = interaction.values; // array of class names

			// Fetch all classes for this guild
			const snap = await db.collection(interaction.guild.id).get();

			// Loop through each class and add/remove roles
			for (const doc of snap.docs) {
				const roleId = doc.data()?.roleId;
				if (!roleId) continue;
				const role = interaction.guild.roles.cache.get(roleId);
				if (!role) continue;

				if (selected.includes(doc.id)) {
					// Add role if user doesn't have it
					if (!member.roles.cache.has(role.id)) await member.roles.add(role).catch(() => {});
				} else {
					// Remove role if user has it
					if (member.roles.cache.has(role.id)) await member.roles.remove(role).catch(() => {});
				}
			}

			// Update Firestore
			await db.collection('users')
				.doc(member.id)
				.collection('guilds')
				.doc(interaction.guild.id)
				.set({ classes: selected, updatedAt: new Date() }, { merge: true });

			// Rebuild menu so selected items remain checked
			const menu = await buildClassMenu(db, interaction.guild.id, selected);

			await interaction.editReply({
				content: 'Your classes have been updated:',
				components: [menu]
			});
		}

	},
};