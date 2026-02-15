const { Events, GuildAuditLogs } = require('discord.js');

module.exports = {
    name: Events.ThreadCreate,
    once: false,
    execute(thread) {
        const tags = thread.appliedTags

        const threadTags = tags.map(s => thread.parent.availableTags.find(t => t.id === s)).map(x => x.name)
        const guildRoles = []

        thread.guild.roles
        .fetch()
            .then(roles => {
                roles.forEach(role => {
                    guildRoles.push(role.name)
                });
                
                let overlap = threadTags.filter(value => guildRoles.includes(value));
                overlap.forEach(thing => {
                    const role = thread.guild.roles.cache.find(r => r.name === thing);
                    if (!role) return;

                    thread.send(`${role}`);
                })
            })
        .catch(console.error);
    },
};