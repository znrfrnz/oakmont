const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { loadAllGiveaways } = require('../db/giveaways.db');

module.exports = {
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
      const winnersRow = new ActionRowBuilder().addComponents(winnersInput);
      const gifRow = new ActionRowBuilder().addComponents(gifInput);

      // Add the rows to the modal (without channelRow)
      modal.addComponents(prizeRow, durationRow, minRoleRow, winnersRow, gifRow);

      // Show the modal to the user
      await interaction.showModal(modal);
   },
};

// Add /rerollgiveaway command
module.exports.reroll = {
   data: new SlashCommandBuilder()
      .setName('rerollgiveaway')
      .setDescription('Reroll the winner(s) for a giveaway (admin only).')
      .addStringOption(opt =>
         opt.setName('messageid')
            .setDescription('The message ID of the giveaway')
            .setRequired(true)
      ),
   async execute(interaction, db) {
      const adminRoleId = process.env.ADMIN_ROLE_ID;
      if (!interaction.member.roles.cache.has(adminRoleId)) {
         await interaction.reply({ content: '❌ Only admins can use this command.', ephemeral: true });
         return;
      }
      const messageId = interaction.options.getString('messageid');
      const giveaways = await loadAllGiveaways();
      const g = giveaways.find(g => g.messageId === messageId && g.guildId === interaction.guild.id);
      if (!g) {
         await interaction.reply({ content: '❌ Giveaway not found.', ephemeral: true });
         return;
      }
      const channel = interaction.guild.channels.cache.get(g.channelId);
      if (!channel) {
         await interaction.reply({ content: '❌ Giveaway channel not found.', ephemeral: true });
         return;
      }
      if (!global.giveawayEntries || !global.giveawayEntries[messageId]) {
         await interaction.reply({ content: '❌ No entries found for this giveaway.', ephemeral: true });
         return;
      }
      // Winner picking logic (same as in interactionCreate.js)
      let eligibleUserIds = Array.from(global.giveawayEntries[messageId]);
      if (g.minRole) {
         let role = interaction.guild.roles.cache.find(r => r.id === g.minRole || r.name.toLowerCase() === g.minRole.toLowerCase());
         if (role) {
            eligibleUserIds = eligibleUserIds.filter(uid => {
               const member = interaction.guild.members.cache.get(uid);
               return member && member.roles.cache.has(role.id);
            });
         }
      }
      if (!eligibleUserIds.length) {
         await channel.send('No eligible users entered the giveaway. 😢');
         await interaction.reply({ content: 'No eligible users to reroll.', ephemeral: true });
         return;
      }
      const pool = [...eligibleUserIds];
      const winners = [];
      const numWinners = g.numWinners || 1;
      while (winners.length < Math.min(numWinners, pool.length)) {
         const idx = Math.floor(Math.random() * pool.length);
         winners.push(pool.splice(idx, 1)[0]);
      }
      if (winners.length === 1) {
         await channel.send(`🎉 Reroll: Congratulations <@${winners[0]}>! You won **${g.prize}**!`);
      } else {
         await channel.send(`🎉 Reroll: Congratulations ${winners.map(uid => `<@${uid}>`).join(', ')}! You won **${g.prize}**!`);
      }
      await interaction.reply({ content: 'Reroll complete!', ephemeral: true });
   }
}; 