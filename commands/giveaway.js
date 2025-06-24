const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { loadAllGiveaways, deleteGiveaway } = require('../db/giveaways.db');

// Global timer store to track active giveaway timers
if (!global.giveawayTimers) {
   global.giveawayTimers = new Map();
}

module.exports = {
   data: new SlashCommandBuilder()
      .setName('giveaway')
      .setDescription('Manage giveaways')
      .setDefaultMemberPermissions(0x8) // Administrator permission
      .addSubcommand(subcommand =>
         subcommand
            .setName('create')
            .setDescription('Start a new giveaway')
      )
      .addSubcommand(subcommand =>
         subcommand
            .setName('reroll')
            .setDescription('Reroll the winner(s) for a giveaway')
            .addStringOption(opt =>
               opt.setName('messageid')
                  .setDescription('The message ID of the giveaway')
                  .setRequired(true)
            )
      )
      .addSubcommand(subcommand =>
         subcommand
            .setName('cancel')
            .setDescription('Cancel an ongoing giveaway')
            .addStringOption(opt =>
               opt.setName('messageid')
                  .setDescription('The message ID of the giveaway')
                  .setRequired(true)
            )
      ),

   async execute(interaction, db) {
      // Restrict to admins only
      const adminRoleId = process.env.ADMIN_ROLE_ID;
      if (!interaction.member.roles.cache.has(adminRoleId)) {
         await interaction.reply({ content: '❌ Only admins can use this command.', flags: 64 });
         return;
      }

      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
         case 'create':
            await handleCreateGiveaway(interaction);
            break;
         case 'reroll':
            await handleRerollGiveaway(interaction, db);
            break;
         case 'cancel':
            await handleCancelGiveaway(interaction, db);
            break;
      }
   },
};

/**
 * Handles creating a new giveaway
 */
async function handleCreateGiveaway(interaction) {
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

   // Add the rows to the modal
   modal.addComponents(prizeRow, durationRow, minRoleRow, winnersRow, gifRow);

   // Show the modal to the user
   await interaction.showModal(modal);
}

/**
 * Handles rerolling a giveaway
 */
async function handleRerollGiveaway(interaction, db) {
   const messageId = interaction.options.getString('messageid');
   const giveaways = await loadAllGiveaways();
   const g = giveaways.find(g => g.messageId === messageId && g.guildId === interaction.guild.id);

   if (!g) {
      await interaction.reply({ content: '❌ Giveaway not found.', flags: 64 });
      return;
   }

   const channel = interaction.guild.channels.cache.get(g.channelId);
   if (!channel) {
      await interaction.reply({ content: '❌ Giveaway channel not found.', flags: 64 });
      return;
   }

   if (!global.giveawayEntries || !global.giveawayEntries[messageId]) {
      await interaction.reply({ content: '❌ No entries found for this giveaway.', flags: 64 });
      return;
   }

   // Winner picking logic
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
      await interaction.reply({ content: 'No eligible users to reroll.', flags: 64 });
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

   await interaction.reply({ content: 'Reroll complete!', flags: 64 });
}

/**
 * Handles canceling a giveaway
 */
async function handleCancelGiveaway(interaction, db) {
   const messageId = interaction.options.getString('messageid');
   const giveaways = await loadAllGiveaways();
   const g = giveaways.find(g => g.messageId === messageId && g.guildId === interaction.guild.id);

   if (!g) {
      await interaction.reply({ content: '❌ Giveaway not found.', flags: 64 });
      return;
   }

   const channel = interaction.guild.channels.cache.get(g.channelId);
   if (!channel) {
      await interaction.reply({ content: '❌ Giveaway channel not found.', flags: 64 });
      return;
   }

   try {
      // Clear any pending timer for this giveaway
      if (global.giveawayTimers && global.giveawayTimers.has(messageId)) {
         clearTimeout(global.giveawayTimers.get(messageId));
         global.giveawayTimers.delete(messageId);
         console.log(`✅ Cleared timer for cancelled giveaway: ${messageId}`);
      }

      // Try to fetch and delete the original message
      const message = await channel.messages.fetch(messageId);
      if (message) {
         await message.delete();
      }

      // Delete the giveaway from database
      await deleteGiveaway(messageId);

      // Send cancellation notification
      await channel.send(`❌ **Giveaway Cancelled**\n\nThe giveaway for **${g.prize}** has been cancelled by ${interaction.user}.`);

      await interaction.reply({ content: '✅ Giveaway cancelled successfully!', flags: 64 });
   } catch (error) {
      console.error('Error cancelling giveaway:', error);
      await interaction.reply({ content: '❌ Error cancelling giveaway. It may have already ended.', flags: 64 });
   }
} 