const { SlashCommandBuilder } = require('discord.js');
const { handleTicketClose, markAsProcessing, unmarkProcessing } = require('../utils/ticketUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket management commands')
    .addSubcommand(sub => 
      sub.setName('close')
        .setDescription('Close the current ticket')
    )
    .addSubcommand(sub =>
      sub.setName('process')
        .setDescription('Mark ticket as being processed')
    )
    .addSubcommand(sub =>
      sub.setName('unprocess')
        .setDescription('Remove processing status from ticket')
    ),
    
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'close') {
      await handleTicketClose(interaction);
    } else if (subcommand === 'process') {
      await markAsProcessing(interaction);
    } else if (subcommand === 'unprocess') {
      await unmarkProcessing(interaction);
    }
  }
};