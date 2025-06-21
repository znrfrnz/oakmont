const { 
  SlashCommandBuilder, 
  PermissionFlagsBits
} = require('discord.js');

const updateQueueEmbed = require('../utils/updateQueueEmbed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('updatequeue')
    .setDescription('Updates the ticket queue status display')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      await updateQueueEmbed(interaction.client);
      await interaction.editReply({ 
        content: '✅ Ticket queue status has been updated!', 
        ephemeral: true 
      });
    } catch (error) {
      console.error('Error updating queue:', error);
      await interaction.editReply({
        content: '❌ Error updating queue status: ' + error.message,
        ephemeral: true
      });
    }
  }
};