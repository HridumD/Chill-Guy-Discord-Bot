async function safeReply(interaction, contentp, ephemeralp) {
    await interaction.deferReply()
    await interaction.editReply({ content: contentp, ephemeral: ephemeralp})
}

module.exports.safeReply = safeReply