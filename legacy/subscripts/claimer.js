const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  SlashCommandBuilder,
  PermissionsBitField
} = require('discord.js');
const admin = require('firebase-admin');
const { TOKEN } = require('./config.json'); // Only TOKEN

/* ---------------- HARD-CODED IDS ---------------- */
const CLIENT_ID = '1471686194021662911';
const GUILD_ID = '1333970916652351548';

/* ---------------- FIREBASE ---------------- */
admin.initializeApp({
  credential: admin.credential.cert(require('./firestore_key.json'))
});
const db = admin.firestore();

/* ---------------- DISCORD CLIENT ---------------- */
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

/* ---------------- SLASH COMMANDS ---------------- */
const classAdd = new SlashCommandBuilder()
  .setName('classadder')
  .setDescription('Add a class')
  .addStringOption(o =>
    o.setName('name').setDescription('Class name').setRequired(true)
  );

const classRemove = new SlashCommandBuilder()
  .setName('classremove')
  .setDescription('Remove a class')
  .addStringOption(o =>
    o.setName('name')
      .setDescription('Class to remove')
      .setRequired(true)
      .setAutocomplete(true)
  );

const myClasses = new SlashCommandBuilder()
  .setName('myclasses')
  .setDescription('Manage your current class selections');

/* ---------------- REGISTER COMMANDS ---------------- */
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: [classAdd.toJSON(), classRemove.toJSON(), myClasses.toJSON()] }
    );
    console.log('Slash commands registered successfully.');
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
})();

/* ---------------- CLASS MENU ---------------- */
async function buildClassMenu(selectedClasses = []) {
  const snap = await db.collection(GUILD_ID).get();

  if (snap.empty) {
    return new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('class_select_disabled')
        .setPlaceholder('No classes available')
        .setMinValues(0)
        .setMaxValues(1)
        .setDisabled(true)
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('No classes')
            .setValue('none')
        )
    );
  }

  const options = snap.docs
    .map(doc => doc.id)
    .filter(name => typeof name === 'string' && name.length > 0)
    .slice(0, 25)
    .map(name =>
      new StringSelectMenuOptionBuilder()
        .setLabel(name)
        .setValue(name)
        .setDefault(selectedClasses.includes(name))
    );

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('class_select')
      .setPlaceholder('Pick your classes')
      .setMinValues(0)
      .setMaxValues(options.length)
      .addOptions(options)
  );
}

/* ---------------- INTERACTIONS ---------------- */
client.on('interactionCreate', async interaction => {

  /* ---------- AUTOCOMPLETE ---------- */
  if (interaction.isAutocomplete() && interaction.commandName === 'classremove') {
    const focused = interaction.options.getFocused().toLowerCase();
    const snap = await db.collection(GUILD_ID).get();
    const choices = snap.docs.map(d => d.id);
    const filtered = choices.filter(c => c.toLowerCase().includes(focused)).slice(0, 25);
    await interaction.respond(filtered.map(c => ({ name: c, value: c })));
    return;
  }

  /* ---------- SLASH COMMANDS ---------- */
  if (interaction.isChatInputCommand()) {
    const guild = interaction.guild;
    const member = interaction.member;

    // ADD CLASS
    if (interaction.commandName === 'classadder') {
      const name = interaction.options.getString('name');
      const ref = db.collection(GUILD_ID).doc(name);
      if ((await ref.get()).exists) return interaction.reply({ content: 'Class already exists.', ephemeral: true });

      if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles))
        return interaction.reply({ content: 'Bot lacks MANAGE_ROLES.', ephemeral: true });

      const role = await guild.roles.create({ name });
      await ref.set({ roleId: role.id, createdAt: new Date() });

      await interaction.reply({ content: `Class **${name}** added.` });
    }

    // REMOVE CLASS
    if (interaction.commandName === 'classremove') {
      const name = interaction.options.getString('name');
      const ref = db.collection(GUILD_ID).doc(name);
      const snap = await ref.get();
      if (!snap.exists) return interaction.reply({ content: 'Class not found.', ephemeral: true });

      const roleId = snap.data().roleId;
      const role = guild.roles.cache.get(roleId);
      if (role) await role.delete().catch(() => {});

      await ref.delete();

      // Remove class from all users
      const usersSnap = await db.collection('users').get();
      for (const userDoc of usersSnap.docs) {
        const guildRef = userDoc.ref.collection('guilds').doc(GUILD_ID);
        const guildSnap = await guildRef.get();
        if (!guildSnap.exists) continue;

        const classes = guildSnap.data().classes || [];
        if (classes.includes(name)) {
          await guildRef.update({ classes: classes.filter(c => c !== name) });
        }
      }

      await interaction.reply({ content: `Class **${name}** removed.` });
    }

    // MY CLASSES
    if (interaction.commandName === 'myclasses') {
      const userId = member.id;
      const snap = await db.collection('users').doc(userId)
        .collection('guilds').doc(GUILD_ID).get();
      const savedClasses = snap.exists ? snap.data().classes || [] : [];

      const menu = await buildClassMenu(savedClasses);

      await interaction.reply({
        content: savedClasses.length ? 'Manage your classes:' : 'You have no classes selected yet.',
        components: [menu],
        ephemeral: true
      });
    }
  }

  /* ---------- SELECT MENU ---------- */
  if (interaction.isStringSelectMenu()) {
    if (!interaction.customId.startsWith('class_select')) return;

    const member = interaction.member;
    const selected = interaction.values ?? [];

    // Assign/remove roles
    const snap = await db.collection(GUILD_ID).get();
    for (const doc of snap.docs) {
      const roleId = doc.data()?.roleId;
      if (!roleId) continue;
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) continue;

      if (selected.includes(doc.id)) {
        if (!member.roles.cache.has(role.id)) await member.roles.add(role).catch(() => {});
      } else {
        if (member.roles.cache.has(role.id)) await member.roles.remove(role).catch(() => {});
      }
    }

    // Save user's selections
    await db.collection('users').doc(member.id)
      .collection('guilds').doc(GUILD_ID)
      .set({ classes: selected, updatedAt: new Date() }, { merge: true });

    // Build ephemeral menu with only this user's selections
    const userMenu = await buildClassMenu(selected);
    await interaction.reply({
      content: 'Your roles have been updated. Select classes again if needed:',
      components: [userMenu],
      ephemeral: true
    });
  }
});

/* ---------------- AUTO-RESTORE ON JOIN ---------------- */
client.on('guildMemberAdd', async member => {
  const snap = await db.collection('users').doc(member.id)
    .collection('guilds').doc(GUILD_ID).get();
  if (!snap.exists) return;

  const saved = snap.data().classes || [];
  if (!saved.length) return;

  const classSnap = await db.collection(GUILD_ID).get();
  const roles = [];
  classSnap.docs.forEach(doc => {
    if (saved.includes(doc.id)) {
      const roleId = doc.data().roleId;
      if (roleId) roles.push(roleId);
    }
  });

  if (roles.length) await member.roles.add(roles).catch(() => {});
});

/* ---------------- READY ---------------- */
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(TOKEN);
