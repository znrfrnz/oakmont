const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { loadAllGiveaways } = require('../db/giveaways.db');

module.exports = [
   {
      data: new SlashCommandBuilder()
         .setName('giveaway')
         .setDescription('Start a giveaway with a custom prize, duration, and minimum role.'),
      async execute(interaction, db) {
         // Restrict to admins only
         const adminRoleId = process.env.ADMIN_ROLE_ID;
         if (!interaction.member.roles.cache.has(adminRoleId)) {
            await interaction.reply({ content: '❌ Only admins can use this command.', ephemeral: true });
            return;
         }
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

         // GIF URL input
         const gifInput = new TextInputBuilder()
            .setCustomId('giveaway_gif_url')
            .setLabel('GIF URL (optional)')
            .setPlaceholder('https://media.giphy.com/media/xyz.gif')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(300);

         // Add inputs to rows
         const prizeRow = new ActionRowBuilder().addComponents(prizeInput);
         const durationRow = new ActionRowBuilder().addComponents(durationInput);
         const minRoleRow = new ActionRowBuilder().addComponents(minRoleInput);
         const channelRow = new ActionRowBuilder().addComponents(channelInput);
         const winnersRow = new ActionRowBuilder().addComponents(winnersInput);
         const gifRow = new ActionRowBuilder().addComponents(gifInput);

         // Add the rows to the modal
         modal.addComponents(prizeRow, durationRow, minRoleRow, channelRow, winnersRow, gifRow);

         // Show the modal to the user
         await interaction.showModal(modal);
      },
   }
]; 