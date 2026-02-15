const { Client, GatewayIntentBits } = require("discord.js");
const { TOKEN } = require("./config.json");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("threadCreate", async (thread) => {
  try {
    // Make sure thread has tags
    if (!thread.appliedTags || thread.appliedTags.length === 0) return;

    // Fetch parent channel to get available tags
    const parentChannel = await thread.guild.channels.fetch(thread.parentId);
    if (!parentChannel || !parentChannel.availableTags) return;

    for (const tagId of thread.appliedTags) {
      const tag = parentChannel.availableTags.find(t => t.id === tagId);
      if (!tag) continue;

      // Find role by same name as tag
      const role = thread.guild.roles.cache.find(r => r.name === tag.name);

      if (role) {
        thread.send(`${role}`);
      } else {
        console.log(
          `No role found for tag "${tag.name}" in server "${thread.guild.name}"`
        );
      }
    }
  } catch (err) {
    console.error("Error pinging role:", err);
  }
});

client.login(TOKEN);
