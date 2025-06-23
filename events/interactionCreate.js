const {
   Events,
   ChannelType,
   PermissionFlagsBits,
   EmbedBuilder,
   ButtonBuilder,
   ButtonStyle,
   ActionRowBuilder,
   ComponentType,
   InteractionType,
   ModalBuilder,
   TextInputBuilder,
   TextInputStyle
} = require('discord.js');

// Add this at the top with your other requires
const updateStockEmbed = require('../utils/updateStockEmbed');
const updateQueueEmbed = require('../utils/updateQueueEmbed');
const updateFaqEmbed = require('../utils/updateFaqEmbed');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

// Initialize database connection
const db = new sqlite3.Database(path.join(__dirname, '../db/shop.db'));

// Import order handler functions
const { handleOrderSubmit, handleOrderComplete, handleOrderCancel, handleOrderCancelConfirm, findBestMatch } = require('../handlers/orderHandler');

// Import ticket handler functions
const { handleTicketComplete, markAsProcessing, unmarkProcessing, showPaymentMethods } = require('../handlers/ticketHandler');

// Import FAQ handler functions
const { handleFaqAddModalSubmit, handleFaqEditSelection, handleFaqEditModalSubmit, handleFaqRemoveSelection, handleFaqReorderSelection, handleFaqReorderModalSubmit } = require('../handlers/faqHandler');

module.exports = {
   name: Events.InteractionCreate,
   async execute(interaction) {
      if (interaction.isChatInputCommand()) {
         const command = interaction.client.commands.get(interaction.commandName);
         if (!command) return;

         try {
            // Pass the db instance to the command
            await command.execute(interaction, db);
         } catch (err) {
            console.error(err);
            await interaction.reply({ content: '❌ Error executing command.', ephemeral: true });
         }
         return;
      }

      if (interaction.isAutocomplete()) {
         const command = interaction.client.commands.get(interaction.commandName);

         if (!command || !command.autocomplete) return;

         try {
            await command.autocomplete(interaction, db);
         } catch (error) {
            console.error(`Error with autocomplete for command ${interaction.commandName}`);
            console.error(error);
         }
         return;
      }

      // Handle button interactions within async function
      if (interaction.isButton()) {
         // Handle ticket close buttons
         if (interaction.customId === 'ticket_close') {
            const { handleTicketClose } = require('../utils/ticketUtils');
            await handleTicketClose(interaction);
            return;
         }

         if (interaction.customId === 'ticket_close_confirm') {
            const { handleTicketClose } = require('../utils/ticketUtils');
            await handleTicketClose(interaction, true);
            return;
         }

         if (interaction.customId === 'ticket_close_cancel') {
            await interaction.update({
               content: '✅ Ticket closing cancelled',
               embeds: [],
               components: []
            });
            return;
         }

         // Handle order completion button
         if (interaction.customId === 'order_complete') {
            await handleOrderComplete(interaction, db);
            return;
         }

         // Handle order cancellation button
         if (interaction.customId === 'order_cancel') {
            await handleOrderCancel(interaction);
            return;
         }

         // Handle order cancellation confirmation
         if (interaction.customId === 'order_cancel_confirm') {
            await handleOrderCancelConfirm(interaction);
            return;
         }

         // Handle order cancellation abort
         if (interaction.customId === 'order_cancel_abort') {
            await interaction.update({
               content: '✅ Order cancellation aborted.',
               components: []
            });
            return;
         }

         // Handle ticket processing button
         if (interaction.customId === 'ticket_processing') {
            await markAsProcessing(interaction);
            return;
         }

         // Handle order processing button
         if (interaction.customId === 'order_processing') {
            await markAsProcessing(interaction);
            return;
         }

         // Handle ticket unprocessing button
         if (interaction.customId === 'ticket_unprocessing') {
            await unmarkProcessing(interaction);
            return;
         }

         // Handle order unprocessing button
         if (interaction.customId === 'order_unprocessing') {
            await unmarkProcessing(interaction);
            return;
         }

         // Handle ticket claim button
         if (interaction.customId === 'claim_ticket') {
            const { claimTicket } = require('../utils/ticketUtils');
            await claimTicket(interaction);
            return;
         }

         // Handle ticket unclaim button
         if (interaction.customId === 'unclaim_ticket') {
            const { unclaimTicket } = require('../utils/ticketUtils');
            await unclaimTicket(interaction);
            return;
         }

         // Handle ticket completion button
         if (interaction.customId === 'ticket_complete') {
            await handleTicketComplete(interaction);
            return;
         }

         // Handle payment methods button
         if (interaction.customId === 'show_payment_methods') {
            await showPaymentMethods(interaction, db);
            return;
         }

         // Handle order payment methods button
         if (interaction.customId === 'show_order_payment_methods') {
            const { showPaymentMethods } = require('../handlers/orderHandler');
            await showPaymentMethods(interaction, db);
            return;
         }

         // Handle stock removal confirmation buttons
         if (interaction.customId === 'stock_remove_confirm') {
            // Get the original search term from the message content
            const messageContent = interaction.message.content;
            const searchMatch = messageContent.match(/You searched for: \*\*"([^"]+)"\*\*/);
            const matchedItemMatch = messageContent.match(/Matched to: \*\*"([^"]+)"\*\*/);

            if (searchMatch && matchedItemMatch) {
               const searchTerm = searchMatch[1];
               const matchedItemName = matchedItemMatch[1];

               // Remove the item
               const result = await new Promise((resolve, reject) => {
                  db.run('DELETE FROM stock WHERE name = ?', [matchedItemName], function (err) {
                     if (err) reject(err);
                     else resolve(this.changes);
                  });
               });

               if (result > 0) {
                  await updateStockEmbed(interaction.client, db);
                  await interaction.update({
                     content: `✅ Confirmed! Removed **${matchedItemName}** from stock.`,
                     components: []
                  });
               } else {
                  await interaction.update({
                     content: `❌ Error: Item **${matchedItemName}** not found in stock.`,
                     components: []
                  });
               }
            } else {
               await interaction.update({
                  content: '❌ Error: Could not process confirmation.',
                  components: []
               });
            }
            return;
         }

         if (interaction.customId === 'stock_remove_cancel') {
            await interaction.update({
               content: '❌ Stock removal cancelled.',
               components: []
            });
            return;
         }

         // Handle stock edit confirmation buttons
         if (interaction.customId === 'stock_edit_confirm') {
            // Get the original search term and matched item from the message content
            const messageContent = interaction.message.content;
            const searchMatch = messageContent.match(/You searched for: \*\*"([^"]+)"\*\*/);
            const matchedItemMatch = messageContent.match(/Matched to: \*\*"([^"]+)"\*\*/);

            if (searchMatch && matchedItemMatch) {
               const searchTerm = searchMatch[1];
               const matchedItemName = matchedItemMatch[1];

               // For edit confirmation, we need to get the original command interaction
               // Since we can't easily get the original options, we'll show a message
               // asking the user to use the exact command
               await interaction.update({
                  content: `✅ Confirmed! Please use \`/stock edit name:"${matchedItemName}"\` with your desired price and/or quantity values to complete the edit.`,
                  components: []
               });
            } else {
               await interaction.update({
                  content: '❌ Error: Could not process edit confirmation.',
                  components: []
               });
            }
            return;
         }

         if (interaction.customId === 'stock_edit_cancel') {
            await interaction.update({
               content: '❌ Stock edit cancelled.',
               components: []
            });
            return;
         }

         // Handle any other buttons you have...
      }

      const { guild, user, customId, member } = interaction;
      const denLordRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'den lord');
      const customerRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'customer');

      // 🎫 Support ticket creation (from helpdesk)
      if (customId === 'open_ticket') {
         // Show the modal for creating a support ticket
         const modal = new ModalBuilder()
            .setCustomId('ticket_create_modal')
            .setTitle('Create Support Ticket');

         // Add inputs for ticket details
         const subjectInput = new TextInputBuilder()
            .setCustomId('ticketSubject')
            .setLabel('Subject')
            .setPlaceholder('Brief description of your issue')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);

         const descriptionInput = new TextInputBuilder()
            .setCustomId('ticketDescription')
            .setLabel('Description')
            .setPlaceholder('Please provide detailed information about your issue')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

         const priorityInput = new TextInputBuilder()
            .setCustomId('ticketPriority')
            .setLabel('Priority (Optional)')
            .setPlaceholder('Low, Medium, High, or Urgent')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(20);

         // Add inputs to the modal
         const firstActionRow = new ActionRowBuilder().addComponents(subjectInput);
         const secondActionRow = new ActionRowBuilder().addComponents(descriptionInput);
         const thirdActionRow = new ActionRowBuilder().addComponents(priorityInput);

         modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

         await interaction.showModal(modal);
         return;
      }

      // 🎫 Ticket creation
      if (customId === 'create_ticket') {
         await interaction.deferReply({ ephemeral: true });

         if (!denLordRole || !customerRole) {
            return interaction.followUp({
               content: '❌ Roles "den lord" or "customer" not found.',
               flags: 64,
            });
         }

         const existing = guild.channels.cache.find(c => c.topic && c.topic.includes(`: ${user.id}`));
         if (existing) {
            return interaction.followUp({
               content: `❗ You already have an open ticket: <#${existing.id}>`,
               flags: 64,
            });
         }

         // Create a channel name based on the user's name and subject
         const randomId = Math.random().toString(36).substring(2, 7).toUpperCase();
         const channelName = `support-${interaction.user.username}-${randomId}`;

         // Create proper permission structure
         const permissionOverwrites = [
            {
               // Deny everyone by default
               id: interaction.guild.id, // @everyone role
               deny: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory
               ]
            },
            {
               // Allow the ticket creator
               id: interaction.user.id,
               allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.AddReactions
               ]
            }
         ];

         // Add admin role permissions
         const adminRoleId = process.env.ADMIN_ROLE_ID;
         if (adminRoleId) {
            permissionOverwrites.push({
               id: adminRoleId,
               allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.ManageMessages,
                  PermissionFlagsBits.ManageChannels,
                  PermissionFlagsBits.AddReactions
               ]
            });
         }

         // --- TICKET CATEGORY ENFORCEMENT ---
         // Always fetch and require the open tickets category from .env
         const openCategoryId = process.env.TICKETS_OPEN_CATEGORY;
         let ticketCategory = null;
         if (openCategoryId) {
            try {
               const fetchedCategory = await interaction.guild.channels.fetch(openCategoryId);
               if (fetchedCategory && fetchedCategory.type === ChannelType.GuildCategory) {
                  ticketCategory = fetchedCategory;
                  console.log(`Found open tickets category: ${ticketCategory.name}`);
               } else {
                  console.error(`Channel ${openCategoryId} exists but is not a category. Ticket will NOT be created.`);
                  return await interaction.reply({
                     content: '❌ Ticket category misconfiguration. Please contact an admin.',
                     ephemeral: true
                  });
               }
            } catch (err) {
               console.error('Error fetching open tickets category:', err);
               return await interaction.reply({
                  content: '❌ Could not find the open tickets category. Please contact an admin.',
                  ephemeral: true
               });
            }
         } else {
            return await interaction.reply({
               content: '❌ Ticket category is not set in the .env file. Please contact an admin.',
               ephemeral: true
            });
         }
         // --- END ENFORCEMENT ---
         // Create the ticket channel - always set parent to the open tickets category
         const channelOptions = {
            name: channelName,
            type: ChannelType.GuildText,
            permissionOverwrites: permissionOverwrites,
            topic: `Support ticket for ${interaction.user.tag}: ${interaction.user.id}`,
            reason: `Support ticket created by ${interaction.user.tag}`,
            parent: ticketCategory.id
         };
         const ticketChannel = await interaction.guild.channels.create(channelOptions);

         // Create the ticket embed
         const ticketEmbed = new EmbedBuilder()
            .setTitle('🎫 Support Ticket Created')
            .setDescription(`Support ticket created by ${interaction.user}`)
            .setColor(getPriorityColor('Medium'))
            .addFields(
               { name: 'User', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
               { name: 'Channel', value: `${ticketChannel}`, inline: true }
            )
            .setTimestamp();

         // Add buttons for managing the ticket
         const buttonRow = new ActionRowBuilder()
            .addComponents(
               new ButtonBuilder()
                  .setCustomId('ticket_processing')
                  .setLabel('Mark as Processing')
                  .setEmoji('⚙️')
                  .setStyle(ButtonStyle.Primary),
               new ButtonBuilder()
                  .setCustomId('ticket_unprocessing')
                  .setLabel('Unmark Processing')
                  .setEmoji('📝')
                  .setStyle(ButtonStyle.Secondary),
               new ButtonBuilder()
                  .setCustomId('ticket_complete')
                  .setLabel('Complete Ticket')
                  .setEmoji('✅')
                  .setStyle(ButtonStyle.Success),
               new ButtonBuilder()
                  .setCustomId('ticket_close')
                  .setLabel('Close Ticket')
                  .setEmoji('❌')
                  .setStyle(ButtonStyle.Danger),
               new ButtonBuilder()
                  .setCustomId('claim_ticket')
                  .setLabel('Claim Ticket')
                  .setEmoji('🎯')
                  .setStyle(ButtonStyle.Primary)
            );

         // Add a second row for payment methods button
         const paymentButtonRow = new ActionRowBuilder()
            .addComponents(
               new ButtonBuilder()
                  .setCustomId('show_payment_methods')
                  .setLabel('Payment Methods')
                  .setEmoji('💳')
                  .setStyle(ButtonStyle.Secondary)
            );

         // Send the ticket details to the new channel
         await ticketChannel.send({
            content: `${interaction.user} Your support ticket has been created!`,
            embeds: [ticketEmbed],
            components: [buttonRow, paymentButtonRow]
         });

         // Send confirmation to the user
         await interaction.followUp({
            content: `✅ Your support ticket has been created! Please check ${ticketChannel} for assistance.`,
            flags: 64,
         });

         // Update the queue display if that function exists
         if (typeof updateQueueEmbed === 'function') {
            updateQueueEmbed(interaction.client).catch(err => {
               console.error('Error updating queue display:', err);
            });
         }

         return;
      }

      // 🛒 Order creation
      if (customId === 'create_order') {
         // Show the modal immediately for create_order
         const modal = new ModalBuilder()
            .setCustomId('order_create_modal')
            .setTitle('Place an Order');

         // Get sample items from database for examples
         let sampleItems = [];
         try {
            sampleItems = await new Promise((resolve, reject) => {
               db.all('SELECT name FROM stock LIMIT 3', (err, rows) => {
                  if (err) resolve([]);
                  else resolve(rows || []);
               });
            });
         } catch (error) {
            console.error('Error fetching sample items:', error);
         }

         // Create dynamic example based on actual items
         let exampleText = 'Enter Pets, and sheckles';
         if (sampleItems.length > 0) {
            const examples = sampleItems.map(item => `1 ${item.name}`).join(', ');
            exampleText = `e.g. ${examples}, 2 Bear Bee, 5T sheckles`;
         }

         // Add a multi-line input for Pets and Sheckles
         const itemsInput = new TextInputBuilder()
            .setCustomId('orderItems')
            .setLabel('Pets, and Sheckles')
            .setPlaceholder(exampleText)
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

         const requestsInput = new TextInputBuilder()
            .setCustomId('orderRequests')
            .setLabel('Special Requests (Optional)')
            .setPlaceholder('Any special instructions for your order')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1000)
            .setRequired(false);

         // Add inputs to rows
         const itemsRow = new ActionRowBuilder().addComponents(itemsInput);
         const requestsRow = new ActionRowBuilder().addComponents(requestsInput);

         // Add the rows to the modal
         modal.addComponents(itemsRow, requestsRow);

         // Show the modal to the user immediately
         await interaction.showModal(modal);
         return;
      }

      // 🎮 Roblox Game Dev Service ticket creation
      if (customId === 'roblox_dev_service') {
         // Show the modal for creating a Roblox game dev service ticket
         const modal = new ModalBuilder()
            .setCustomId('roblox_dev_ticket_modal')
            .setTitle('Create Roblox Game Dev Service Ticket');

         // Add inputs for Roblox game dev ticket details
         const subjectInput = new TextInputBuilder()
            .setCustomId('robloxTicketSubject')
            .setLabel('Project/Game Name')
            .setPlaceholder('Name of your Roblox game or project')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);

         const descriptionInput = new TextInputBuilder()
            .setCustomId('robloxTicketDescription')
            .setLabel('Service Description')
            .setPlaceholder('Describe what game development service you need (scripting, building, UI design, etc.)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

         const budgetInput = new TextInputBuilder()
            .setCustomId('robloxTicketBudget')
            .setLabel('Budget Range (Optional)')
            .setPlaceholder('e.g., $50-100, 1000-2000 robux, etc.')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(50);

         const timelineInput = new TextInputBuilder()
            .setCustomId('robloxTicketTimeline')
            .setLabel('Timeline (Optional)')
            .setPlaceholder('e.g., 1 week, 2-3 days, ASAP')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(50);

         // Add inputs to the modal
         const firstActionRow = new ActionRowBuilder().addComponents(subjectInput);
         const secondActionRow = new ActionRowBuilder().addComponents(descriptionInput);
         const thirdActionRow = new ActionRowBuilder().addComponents(budgetInput);
         const fourthActionRow = new ActionRowBuilder().addComponents(timelineInput);

         modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);

         await interaction.showModal(modal);
         return;
      }

      // Handle modal submissions
      if (interaction.isModalSubmit()) {
         // Handle order modal submission
         if (interaction.customId === 'order_create_modal') {
            await handleOrderSubmit(interaction, db);
            return;
         }

         // Handle ticket modal submission
         if (interaction.customId === 'ticket_create_modal') {
            await handleTicketModalSubmit(interaction);
            return;
         }

         // Handle Roblox game dev service ticket modal submission
         if (interaction.customId === 'roblox_dev_ticket_modal') {
            await handleRobloxDevTicketModalSubmit(interaction);
            return;
         }

         // Handle FAQ modal submissions
         if (interaction.customId === 'faq_add_modal') {
            await handleFaqAddModalSubmit(interaction, db);
            return;
         }

         if (interaction.customId === 'giveaway_create_modal') {
            // Extract modal fields
            const prize = interaction.fields.getTextInputValue('giveaway_prize');
            const duration = interaction.fields.getTextInputValue('giveaway_duration');
            const minRole = interaction.fields.getTextInputValue('giveaway_min_role');
            const numWinnersInput = interaction.fields.getTextInputValue('giveaway_num_winners');
            let numWinners = parseInt(numWinnersInput, 10);
            if (isNaN(numWinners) || numWinners < 1) numWinners = 1;

            const gifUrl = interaction.fields.getTextInputValue('giveaway_gif_url');

            // Use the channel where the command was run
            const channel = interaction.channel;

            // Parse duration
            const { parseDuration } = require('../utils/createGiveawayUtils');
            const durationMs = parseDuration(duration);
            if (!durationMs || durationMs < 5000) {
               await interaction.reply({ content: '❌ Invalid duration. Use formats like 1h, 2d, 7d, 10m, etc.', ephemeral: true });
               return;
            }

            const endTimeUnix = Math.floor((Date.now() + durationMs) / 1000);

            // Build the giveaway embed
            const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const embed = new EmbedBuilder()
               .setTitle('🎉 Giveaway!')
               .addFields(
                  { name: 'Prize', value: prize, inline: false },
                  { name: 'Duration', value: duration, inline: true },
                  { name: 'Ends', value: `<t:${endTimeUnix}:R>`, inline: true },
                  { name: 'Minimum Role', value: minRole || 'None', inline: true },
                  { name: 'Number of Winners', value: numWinners.toString(), inline: true },
                  { name: 'How to Enter', value: 'React with 🎉 to enter!', inline: false }
               )
               .setTimestamp()
               .setColor(0xFFD700);
            if (gifUrl && gifUrl.startsWith('http')) {
               embed.setImage(gifUrl);
            }

            // Add reroll and cancel buttons
            const buttonRow = new ActionRowBuilder().addComponents(
               new ButtonBuilder()
                  .setCustomId(`giveaway_reroll_${Date.now()}`)
                  .setLabel('Reroll')
                  .setStyle(ButtonStyle.Primary),
               new ButtonBuilder()
                  .setCustomId(`giveaway_cancel_${Date.now()}`)
                  .setLabel('Cancel')
                  .setStyle(ButtonStyle.Danger)
            );

            // Send the embed to the selected channel
            const giveawayMsg = await channel.send({ embeds: [embed], components: [buttonRow] });
            await giveawayMsg.react('🎉');

            // Save to DB for persistence
            const { saveGiveaway, deleteGiveaway } = require('../db/giveaways.db');
            const endTime = Date.now() + durationMs;
            await saveGiveaway({
               messageId: giveawayMsg.id,
               channelId: channel.id,
               guildId: interaction.guild.id,
               prize,
               durationMs,
               minRole,
               endTime,
               numWinners
            });

            await interaction.reply({
               content: `✅ Giveaway started in ${channel}!`,
               ephemeral: true
            });

            // Helper to pick winners
            async function pickWinners(msg, guild, minRole, numWinners, prize, announce = true) {
               const reaction = msg.reactions.cache.get('🎉');
               if (!reaction) {
                  if (announce) await channel.send('No one entered the giveaway. 😢');
                  return [];
               }
               let users = await reaction.users.fetch();
               users = users.filter(u => !u.bot);
               // Filter by minimum role if specified
               let eligibleUsers = users;
               if (minRole) {
                  let role = guild.roles.cache.find(r => r.id === minRole || r.name.toLowerCase() === minRole.toLowerCase());
                  if (role) {
                     eligibleUsers = users.filter(u => {
                        const member = guild.members.cache.get(u.id);
                        return member && member.roles.cache.has(role.id);
                     });
                  }
               }
               if (!eligibleUsers.size) {
                  if (announce) await channel.send('No eligible users entered the giveaway. 😢');
                  return [];
               }
               // Pick unique winners
               const pool = Array.from(eligibleUsers.values());
               const winners = [];
               while (winners.length < Math.min(numWinners, pool.length)) {
                  const idx = Math.floor(Math.random() * pool.length);
                  winners.push(pool.splice(idx, 1)[0]);
               }
               if (announce) {
                  if (winners.length === 1) {
                     await channel.send(`🎉 Congratulations ${winners[0]}! You won **${prize}**!`);
                  } else {
                     await channel.send(`🎉 Congratulations ${winners.map(u => u.toString()).join(', ')}! You won **${prize}**!`);
                  }
               }
               return winners;
            }

            // Schedule the giveaway end
            setTimeout(async () => {
               try {
                  const msg = await channel.messages.fetch(giveawayMsg.id);
                  await pickWinners(msg, interaction.guild, minRole, numWinners, prize, true);
                  await deleteGiveaway(giveawayMsg.id);
               } catch (err) {
                  await channel.send('❌ Error ending the giveaway.');
                  await deleteGiveaway(giveawayMsg.id);
               }
            }, durationMs);
            return;
         }

         if (interaction.customId === 'faq_edit_modal') {
            await handleFaqEditModalSubmit(interaction, db);
            return;
         }

         if (interaction.customId === 'faq_reorder_modal') {
            await handleFaqReorderModalSubmit(interaction, db);
            return;
         }
      }

      // Handle select menu interactions
      if (interaction.isStringSelectMenu()) {
         // Handle FAQ select menu interactions
         if (interaction.customId === 'faq_edit_select') {
            await handleFaqEditSelection(interaction, db);
            return;
         }

         if (interaction.customId === 'faq_remove_select') {
            await handleFaqRemoveSelection(interaction, db);
            return;
         }

         if (interaction.customId === 'faq_reorder_select') {
            await handleFaqReorderSelection(interaction, db);
            return;
         }
      }

      // Handle reroll/cancel buttons for giveaways
      if (interaction.isButton() && interaction.customId.startsWith('giveaway_reroll_')) {
         // Only allow reroll by admins or the user who started the giveaway (for now, allow all)
         try {
            const msg = await interaction.channel.messages.fetch(interaction.message.id);
            // Read embed for prize, minRole, numWinners
            const embed = msg.embeds[0];
            const prize = embed.fields.find(f => f.name === 'Prize')?.value || 'the prize';
            const minRole = embed.fields.find(f => f.name === 'Minimum Role')?.value;
            const numWinners = parseInt(embed.fields.find(f => f.name === 'Number of Winners')?.value || '1', 10);
            const winners = await (async () => {
               const reaction = msg.reactions.cache.get('🎉');
               if (!reaction) return [];
               let users = await reaction.users.fetch();
               users = users.filter(u => !u.bot);
               let eligibleUsers = users;
               if (minRole && minRole !== 'None') {
                  let role = interaction.guild.roles.cache.find(r => r.id === minRole || r.name.toLowerCase() === minRole.toLowerCase());
                  if (role) {
                     eligibleUsers = users.filter(u => {
                        const member = interaction.guild.members.cache.get(u.id);
                        return member && member.roles.cache.has(role.id);
                     });
                  }
               }
               if (!eligibleUsers.size) return [];
               const pool = Array.from(eligibleUsers.values());
               const winners = [];
               while (winners.length < Math.min(numWinners, pool.length)) {
                  const idx = Math.floor(Math.random() * pool.length);
                  winners.push(pool.splice(idx, 1)[0]);
               }
               return winners;
            })();
            if (!winners.length) {
               await interaction.reply({ content: 'No eligible users to reroll.', ephemeral: true });
            } else if (winners.length === 1) {
               await interaction.reply({ content: `🎉 Reroll: Congratulations ${winners[0]}!`, ephemeral: false });
            } else {
               await interaction.reply({ content: `🎉 Reroll: Congratulations ${winners.map(u => u.toString()).join(', ')}!`, ephemeral: false });
            }
         } catch (err) {
            await interaction.reply({ content: '❌ Error rerolling the giveaway.', ephemeral: true });
         }
         return;
      }
      if (interaction.isButton() && interaction.customId.startsWith('giveaway_cancel_')) {
         // Only allow cancel by admins or the user who started the giveaway (for now, allow all)
         try {
            // Remove the giveaway from DB and disable buttons
            const msg = await interaction.channel.messages.fetch(interaction.message.id);
            const { deleteGiveaway } = require('../db/giveaways.db');
            await deleteGiveaway(msg.id);
            await msg.edit({ components: [] });
            await interaction.reply({ content: '❌ Giveaway cancelled.', ephemeral: false });
         } catch (err) {
            await interaction.reply({ content: '❌ Error cancelling the giveaway.', ephemeral: true });
         }
         return;
      }
   },
};

/**
 * Returns a color code based on ticket priority
 * @param {string} priority - The priority level (Low, Medium, High)
 * @returns {number} - The hex color code
 */
function getPriorityColor(priority) {
   switch (priority.toLowerCase()) {
      case 'low':
         return 0x2ecc71; // Green
      case 'medium':
         return 0xf39c12; // Orange
      case 'high':
         return 0xe74c3c; // Red
      case 'urgent':
         return 0xc0392b; // Dark Red
      default:
         return 0x3498db; // Blue (default)
   }
}

/**
 * Handles a ticket modal submission
 * @param {ModalSubmitInteraction} interaction - The modal submit interaction
 */
async function handleTicketModalSubmit(interaction) {
   try {
      // Get values from the modal
      const subject = interaction.fields.getTextInputValue('ticketSubject');
      const description = interaction.fields.getTextInputValue('ticketDescription');
      const priority = interaction.fields.getTextInputValue('ticketPriority') || 'Medium';

      // Defer the reply to give us time to create the channel
      await interaction.deferReply({ ephemeral: true }).catch(err => {
         console.error("Failed to defer reply:", err);
         // Continue execution even if deferral fails
      });

      // Create a channel name based on the user's name and subject
      const randomId = Math.random().toString(36).substring(2, 7).toUpperCase();
      const channelName = `support-${interaction.user.username}-${randomId}`;

      // Create proper permission structure
      const permissionOverwrites = [
         {
            // Deny everyone by default
            id: interaction.guild.id, // @everyone role
            deny: [
               PermissionFlagsBits.ViewChannel,
               PermissionFlagsBits.SendMessages,
               PermissionFlagsBits.ReadMessageHistory
            ]
         },
         {
            // Allow the ticket creator
            id: interaction.user.id,
            allow: [
               PermissionFlagsBits.ViewChannel,
               PermissionFlagsBits.SendMessages,
               PermissionFlagsBits.ReadMessageHistory,
               PermissionFlagsBits.AddReactions
            ]
         }
      ];

      // Add admin role permissions
      const adminRoleId = process.env.ADMIN_ROLE_ID;
      if (adminRoleId) {
         permissionOverwrites.push({
            id: adminRoleId,
            allow: [
               PermissionFlagsBits.ViewChannel,
               PermissionFlagsBits.SendMessages,
               PermissionFlagsBits.ReadMessageHistory,
               PermissionFlagsBits.ManageMessages,
               PermissionFlagsBits.ManageChannels,
               PermissionFlagsBits.AddReactions
            ]
         });
      }

      // Note: USER_ROLE_ID is intentionally not added to permissionOverwrites
      // This ensures only the ticket creator and admins can see the ticket

      // --- TICKET CATEGORY ENFORCEMENT ---
      // Always fetch and require the open tickets category from .env
      const openCategoryId = process.env.TICKETS_OPEN_CATEGORY;
      let ticketCategory = null;
      if (openCategoryId) {
         try {
            const fetchedCategory = await interaction.guild.channels.fetch(openCategoryId);
            if (fetchedCategory && fetchedCategory.type === ChannelType.GuildCategory) {
               ticketCategory = fetchedCategory;
               console.log(`Found open tickets category: ${ticketCategory.name}`);
            } else {
               console.error(`Channel ${openCategoryId} exists but is not a category. Ticket will NOT be created.`);
               return await interaction.reply({
                  content: '❌ Ticket category misconfiguration. Please contact an admin.',
                  ephemeral: true
               });
            }
         } catch (err) {
            console.error('Error fetching open tickets category:', err);
            return await interaction.reply({
               content: '❌ Could not find the open tickets category. Please contact an admin.',
               ephemeral: true
            });
         }
      } else {
         return await interaction.reply({
            content: '❌ Ticket category is not set in the .env file. Please contact an admin.',
            ephemeral: true
         });
      }
      // --- END ENFORCEMENT ---
      // Create the ticket channel - always set parent to the open tickets category
      const channelOptions = {
         name: channelName,
         type: ChannelType.GuildText,
         permissionOverwrites: permissionOverwrites,
         topic: `Support ticket for ${interaction.user.tag}: ${interaction.user.id}`,
         reason: `Support ticket created by ${interaction.user.tag}`,
         parent: ticketCategory.id
      };
      const ticketChannel = await interaction.guild.channels.create(channelOptions);

      // Create the ticket embed
      const ticketEmbed = new EmbedBuilder()
         .setTitle(`🎫 Support Ticket: ${subject}`)
         .setDescription(`Support ticket created by ${interaction.user}`)
         .setColor(getPriorityColor(priority))
         .addFields(
            { name: 'Subject', value: subject, inline: true },
            { name: 'Priority', value: priority, inline: true },
            { name: 'Description', value: description || 'No description provided' }
         )
         .setTimestamp();

      // Add buttons for managing the ticket
      const buttonRow = new ActionRowBuilder()
         .addComponents(
            new ButtonBuilder()
               .setCustomId('ticket_processing')
               .setLabel('Mark as Processing')
               .setEmoji('⚙️')
               .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
               .setCustomId('ticket_unprocessing')
               .setLabel('Unmark Processing')
               .setEmoji('📝')
               .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
               .setCustomId('ticket_complete')
               .setLabel('Complete Ticket')
               .setEmoji('✅')
               .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
               .setCustomId('ticket_close')
               .setLabel('Close Ticket')
               .setEmoji('❌')
               .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
               .setCustomId('claim_ticket')
               .setLabel('Claim Ticket')
               .setEmoji('🎯')
               .setStyle(ButtonStyle.Primary)
         );

      // Add a second row for payment methods button
      const paymentButtonRow = new ActionRowBuilder()
         .addComponents(
            new ButtonBuilder()
               .setCustomId('show_payment_methods')
               .setLabel('Payment Methods')
               .setEmoji('💳')
               .setStyle(ButtonStyle.Secondary)
         );

      // Send the ticket details to the new channel
      await ticketChannel.send({
         content: `${interaction.user} Your support ticket has been created!`,
         embeds: [ticketEmbed],
         components: [buttonRow, paymentButtonRow]
      });

      // Send confirmation to the user
      await interaction.editReply({
         content: `✅ Your support ticket has been created! Please check ${ticketChannel} for assistance.`,
         ephemeral: true
      }).catch(err => console.error("Error editing reply:", err));

      // Update the queue display if that function exists
      if (typeof updateQueueEmbed === 'function') {
         updateQueueEmbed(interaction.client).catch(err => {
            console.error('Error updating queue display:', err);
         });
      }
   } catch (error) {
      console.error('Error creating ticket:', error);
      try {
         await interaction.editReply({
            content: `❌ Error creating ticket: ${error.message}`,
            ephemeral: true
         }).catch(err => console.error("Error editing reply:", err));
      } catch (replyError) {
         console.error('Error sending error message:', replyError);
      }
   }
}

/**
 * Handles a Roblox game development service ticket modal submission
 * @param {ModalSubmitInteraction} interaction - The modal submit interaction
 */
async function handleRobloxDevTicketModalSubmit(interaction) {
   try {
      // Get values from the modal
      const projectName = interaction.fields.getTextInputValue('robloxTicketSubject');
      const serviceDescription = interaction.fields.getTextInputValue('robloxTicketDescription');
      const budget = interaction.fields.getTextInputValue('robloxTicketBudget') || 'Not specified';
      const timeline = interaction.fields.getTextInputValue('robloxTicketTimeline') || 'Not specified';

      // Defer the reply to give us time to create the channel
      await interaction.deferReply({ ephemeral: true }).catch(err => {
         console.error("Failed to defer reply:", err);
         // Continue execution even if deferral fails
      });

      // Create a channel name based on the user's name and project
      const randomId = Math.random().toString(36).substring(2, 7).toUpperCase();
      const channelName = `roblox-dev-${interaction.user.username}-${randomId}`;

      // Create proper permission structure
      const permissionOverwrites = [
         {
            // Deny everyone by default
            id: interaction.guild.id, // @everyone role
            deny: [
               PermissionFlagsBits.ViewChannel,
               PermissionFlagsBits.SendMessages,
               PermissionFlagsBits.ReadMessageHistory
            ]
         },
         {
            // Allow the ticket creator
            id: interaction.user.id,
            allow: [
               PermissionFlagsBits.ViewChannel,
               PermissionFlagsBits.SendMessages,
               PermissionFlagsBits.ReadMessageHistory,
               PermissionFlagsBits.AddReactions
            ]
         }
      ];

      // Add admin role permissions
      const adminRoleId = process.env.ADMIN_ROLE_ID;
      if (adminRoleId) {
         permissionOverwrites.push({
            id: adminRoleId,
            allow: [
               PermissionFlagsBits.ViewChannel,
               PermissionFlagsBits.SendMessages,
               PermissionFlagsBits.ReadMessageHistory,
               PermissionFlagsBits.ManageMessages,
               PermissionFlagsBits.ManageChannels,
               PermissionFlagsBits.AddReactions
            ]
         });
      }

      // --- TICKET CATEGORY ENFORCEMENT ---
      // Always fetch and require the open tickets category from .env
      const openCategoryId = process.env.TICKETS_OPEN_CATEGORY;
      let ticketCategory = null;
      if (openCategoryId) {
         try {
            const fetchedCategory = await interaction.guild.channels.fetch(openCategoryId);
            if (fetchedCategory && fetchedCategory.type === ChannelType.GuildCategory) {
               ticketCategory = fetchedCategory;
               console.log(`Found open tickets category: ${ticketCategory.name}`);
            } else {
               console.error(`Channel ${openCategoryId} exists but is not a category. Ticket will NOT be created.`);
               return await interaction.reply({
                  content: '❌ Ticket category misconfiguration. Please contact an admin.',
                  ephemeral: true
               });
            }
         } catch (err) {
            console.error('Error fetching open tickets category:', err);
            return await interaction.reply({
               content: '❌ Could not find the open tickets category. Please contact an admin.',
               ephemeral: true
            });
         }
      } else {
         return await interaction.reply({
            content: '❌ Ticket category is not set in the .env file. Please contact an admin.',
            ephemeral: true
         });
      }
      // --- END ENFORCEMENT ---

      // Create the ticket channel - always set parent to the open tickets category
      const channelOptions = {
         name: channelName,
         type: ChannelType.GuildText,
         permissionOverwrites: permissionOverwrites,
         topic: `Roblox Game Dev Service ticket for ${interaction.user.tag}: ${interaction.user.id}`,
         reason: `Roblox Game Dev Service ticket created by ${interaction.user.tag}`,
         parent: ticketCategory.id
      };
      const ticketChannel = await interaction.guild.channels.create(channelOptions);

      // Create the ticket embed
      const ticketEmbed = new EmbedBuilder()
         .setTitle(`🎮 Roblox Game Dev Service: ${projectName}`)
         .setDescription(`Game development service request by ${interaction.user}`)
         .setColor(0x9b59b6) // Purple color for Roblox dev service
         .addFields(
            { name: 'Project/Game Name', value: projectName, inline: true },
            { name: 'Budget Range', value: budget, inline: true },
            { name: 'Timeline', value: timeline, inline: true },
            { name: 'Service Description', value: serviceDescription || 'No description provided' }
         )
         .setTimestamp();

      // Add buttons for managing the ticket
      const buttonRow = new ActionRowBuilder()
         .addComponents(
            new ButtonBuilder()
               .setCustomId('ticket_processing')
               .setLabel('Mark as Processing')
               .setEmoji('⚙️')
               .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
               .setCustomId('ticket_unprocessing')
               .setLabel('Unmark Processing')
               .setEmoji('📝')
               .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
               .setCustomId('ticket_complete')
               .setLabel('Complete Ticket')
               .setEmoji('✅')
               .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
               .setCustomId('ticket_close')
               .setLabel('Close Ticket')
               .setEmoji('❌')
               .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
               .setCustomId('claim_ticket')
               .setLabel('Claim Ticket')
               .setEmoji('🎯')
               .setStyle(ButtonStyle.Primary)
         );

      // Add a second row for payment methods button
      const paymentButtonRow = new ActionRowBuilder()
         .addComponents(
            new ButtonBuilder()
               .setCustomId('show_payment_methods')
               .setLabel('Payment Methods')
               .setEmoji('💳')
               .setStyle(ButtonStyle.Secondary)
         );

      // Send the ticket details to the new channel
      await ticketChannel.send({
         content: `${interaction.user} Your Roblox Game Dev Service ticket has been created!`,
         embeds: [ticketEmbed],
         components: [buttonRow, paymentButtonRow]
      });

      // Send confirmation to the user
      await interaction.editReply({
         content: `✅ Your Roblox Game Dev Service ticket has been created! Please check ${ticketChannel} for assistance.`,
         ephemeral: true
      }).catch(err => console.error("Error editing reply:", err));

      // Update the queue display if that function exists
      if (typeof updateQueueEmbed === 'function') {
         updateQueueEmbed(interaction.client).catch(err => {
            console.error('Error updating queue display:', err);
         });
      }
   } catch (error) {
      console.error('Error creating Roblox dev ticket:', error);
      try {
         await interaction.editReply({
            content: `❌ Error creating Roblox dev ticket: ${error.message}`,
            ephemeral: true
         }).catch(err => console.error("Error editing reply:", err));
      } catch (replyError) {
         console.error('Error sending error message:', replyError);
      }
   }
}