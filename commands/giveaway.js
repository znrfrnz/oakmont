const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { loadAllGiveaways } = require('../db/giveaways.db');

module.exports = [
   {
      data: new SlashCommandBuilder()
         .setName('giveaway')
         .setDescription('Start a giveaway with a custom prize, duration, and minimum role.'),
      async execute(interaction) {
         // Create the modal
         const modal = new ModalBuilder()
            .setCustomId('giveaway_create_modal')
            .setTitle('Create a Giveaway');

         // Prize input
         const prizeInput = new TextInputBuilder()
            .setCustomId('giveaway_prize')
            .setLabel('What kind (Prize)')
            .setPlaceholder('e.g. $10 Amazon Gift Card')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);

         // Duration input
         const durationInput = new TextInputBuilder()
            .setCustomId('giveaway_duration')
            .setLabel('Time Duration')
            .setPlaceholder('e.g. 1h, 2d, 7d')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(10);

         // Minimum role input
         const minRoleInput = new TextInputBuilder()
            .setCustomId('giveaway_min_role')
            .setLabel('Minimum Role (Role ID or Name)')
            .setPlaceholder('e.g. Member, 123456789012345678')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(50);

         // Channel input
         const channelInput = new TextInputBuilder()
            .setCustomId('giveaway_channel')
            .setLabel('Channel ID or #mention')
            .setPlaceholder('e.g. #giveaways or 123456789012345678')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(50);

         // Number of winners input
         const winnersInput = new TextInputBuilder()
            .setCustomId('giveaway_num_winners')
            .setLabel('Number of Winners')
            .setPlaceholder('e.g. 1')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(2);

         // Add inputs to rows
         const prizeRow = new ActionRowBuilder().addComponents(prizeInput);
         const durationRow = new ActionRowBuilder().addComponents(durationInput);
         const minRoleRow = new ActionRowBuilder().addComponents(minRoleInput);
         const channelRow = new ActionRowBuilder().addComponents(channelInput);
         const winnersRow = new ActionRowBuilder().addComponents(winnersInput);

         // Add the rows to the modal
         modal.addComponents(prizeRow, durationRow, minRoleRow, channelRow, winnersRow);

         // Show the modal to the user
         await interaction.showModal(modal);
      },
   },
   {
      data: new SlashCommandBuilder()
         .setName('giveaways')
         .setDescription('List all ongoing giveaways.'),
      async execute(interaction) {
         const giveaways = await loadAllGiveaways();
         const serverGiveaways = giveaways.filter(g => g.guildId === interaction.guild.id);
         if (!serverGiveaways.length) {
            await interaction.reply({ content: 'There are no ongoing giveaways in this server.', ephemeral: true });
            return;
         }
         const lines = serverGiveaways.map(g => {
            const channel = interaction.guild.channels.cache.get(g.channelId);
            const timeLeft = Math.max(0, g.endTime - Date.now());
            const mins = Math.floor(timeLeft / 60000);
            const secs = Math.floor((timeLeft % 60000) / 1000);
            return `• ${channel ? channel : '#deleted-channel'} | **${g.prize}** | Ends in ${mins}m ${secs}s | Winners: ${g.numWinners || 1}`;
         });
         await interaction.reply({ content: `**Ongoing Giveaways:**\n${lines.join('\n')}`, ephemeral: true });
      }
   }
]; 