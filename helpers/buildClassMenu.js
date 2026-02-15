// helpers/buildClassMenu.js
const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');

async function buildClassMenu(db, guildId, selectedClasses = []) {
  const snap = await db.collection(guildId).get();

  // No classes case
  if (snap.empty) {
    return new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('class_select_disabled')
        .setPlaceholder('No classes available')
        .setDisabled(true)
        .addOptions([{ label: 'No classes', value: 'none' }])
    );
  }

  const options = snap.docs
    .slice(0, 25) // 🔥 REQUIRED
    .map(doc => ({
      label: doc.id,
      value: doc.id,
      default: selectedClasses.includes(doc.id),
    }));

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('class_select')
      .setPlaceholder('Pick your classes')
      .setMinValues(0)
      .setMaxValues(5)
      .setMaxValues(options.length)
      .addOptions(options)
  );
}

module.exports = { buildClassMenu };
