const {
   EmbedBuilder,
   ButtonBuilder,
   ButtonStyle,
   ActionRowBuilder,
   PermissionFlagsBits,
   ChannelType
} = require('discord.js');
const fs = require('fs/promises');
const path = require('path');

/**
 * Creates a transcript of the ticket channel
 * @param {TextChannel} channel - The ticket channel
 * @returns {Promise<String>} Path to the transcript file
 */
async function createTranscript(channel) {
   try {
      // Create transcripts directory if it doesn't exist
      const dir = path.join(process.cwd(), 'transcripts');
      await fs.mkdir(dir, { recursive: true });

      const messages = await channel.messages.fetch({ limit: 100 });
      const transcript = [];

      // Format each message
      messages.reverse().forEach(msg => {
         const time = msg.createdAt.toLocaleString();
         const content = msg.content || '[No text content]';
         const attachments = msg.attachments.size ?
            `\n[Attachments: ${msg.attachments.map(a => a.url).join(', ')}]` : '';

         transcript.push(`[${time}] ${msg.author.tag}: ${content}${attachments}`);
      });

      // Save transcript to file
      const fileName = `ticket-${channel.name}-${Date.now()}.txt`;
      const filePath = path.join(dir, fileName);
      await fs.writeFile(filePath, transcript.join('\n'));

      return filePath;
   } catch (error) {
      console.error('Error creating transcript:', error);
      return null;
   }
}

/**
 * Sends the confirmation message for closing a ticket
 * @param {Interaction} interaction - The interaction that triggered the closing
 */
async function sendCloseConfirmation(interaction) {
   const closeEmbed = new EmbedBuilder()
      .setTitle('Close Ticket')
      .setDescription('Are you sure you want to close this ticket?')
      .setColor(0xe74c3c) // Red color
      .setFooter({ text: 'This ticket will be permanently deleted' });

   const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
         .setCustomId('ticket_close_confirm')
         .setLabel('Close Ticket')
         .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
         .setCustomId('ticket_close_cancel')
         .setLabel('Cancel')
         .setStyle(ButtonStyle.Secondary)
   );

   await interaction.reply({
      embeds: [closeEmbed],
      components: [confirmRow],
      ephemeral: false // Visible to everyone in the ticket
   });
}

/**
 * Handles the closing of a ticket
 * @param {Interaction} interaction - The button interaction for closing
 * @param {Boolean} isConfirmed - Whether this is the confirmation step
 */
async function handleTicketClose(interaction, isConfirmed = false) {
   // Get the ticket channel
   const channel = interaction.channel;

   // Check if this is a ticket channel with more flexible detection
   // We only want to handle support tickets here, not orders
   if (!channel.name.toLowerCase().includes('support-') &&
      !channel.name.toLowerCase().includes('ticket-') &&
      !channel.name.toLowerCase().includes('roblox-dev-')) {
      return interaction.reply({
         content: '❌ This command can only be used in support ticket channels',
         ephemeral: true
      });
   }

   // Check if user has permission to close tickets
   // Only admins or the ticket creator can close tickets
   const adminRoleId = process.env.ADMIN_ROLE_ID;
   const isAdmin = adminRoleId && interaction.member.roles.cache.some(role =>
      role.id === adminRoleId
   );

   const isTicketCreator = channel.topic?.includes(interaction.user.id); // Check if user is the ticket creator

   if (!isAdmin && !isTicketCreator) {
      return interaction.reply({
         content: '❌ Only administrators or the ticket creator can close tickets',
         ephemeral: true
      });
   }

   // If not confirmed yet, send confirmation message
   if (!isConfirmed) {
      return sendCloseConfirmation(interaction);
   }

   // User confirmed closing the ticket
   await interaction.deferUpdate();

   try {
      // Get the user who created the ticket from the channel topic
      const ticketUserId = channel.topic?.split(':')[1]?.trim();
      const ticketUser = ticketUserId ? await interaction.client.users.fetch(ticketUserId).catch(() => null) : null;

      // Create transcript first
      const transcriptPath = await createTranscript(channel);

      // Notify users that ticket is closing
      const closingEmbed = new EmbedBuilder()
         .setTitle('🔒 Ticket Closing')
         .setDescription(`This ticket is being closed by ${interaction.user}`)
         .setColor(0xe67e22) // Orange color
         .setTimestamp();

      await channel.send({ embeds: [closingEmbed] });

      // Send transcript to logs channel if configured
      const logsChannelId = process.env.TICKETS_LOGS_CHANNEL;
      if (logsChannelId) {
         try {
            const logsChannel = await interaction.client.channels.fetch(logsChannelId);

            if (logsChannel) {
               const logEmbed = new EmbedBuilder()
                  .setTitle('Ticket Closed')
                  .setDescription(`**Ticket:** #${channel.name}\n**Closed by:** ${interaction.user.tag}\n**Created by:** ${ticketUser ? ticketUser.tag : 'Unknown User'}`)
                  .setColor(0xe74c3c)
                  .setTimestamp();

               if (transcriptPath) {
                  await logsChannel.send({
                     embeds: [logEmbed],
                     files: [transcriptPath]
                  });
               } else {
                  await logsChannel.send({ embeds: [logEmbed] });
               }
            }
         } catch (err) {
            console.error('Error sending to logs channel:', err);
         }
      }

      // DM the ticket creator if possible
      if (ticketUser) {
         try {
            const dmEmbed = new EmbedBuilder()
               .setTitle('Your ticket has been closed')
               .setDescription(`Your support ticket in **${interaction.guild.name}** has been closed.`)
               .setColor(0x3498db)
               .setTimestamp();

            await ticketUser.send({ embeds: [dmEmbed] });
         } catch (err) {
            // User might have DMs disabled, just ignore
         }
      }

      // Wait 5 seconds before deleting the channel (for support tickets only)
      setTimeout(async () => {
         try {
            await channel.delete('Ticket closed');
         } catch (err) {
            console.error('Error deleting ticket channel:', err);
         }
      }, 5000);

   } catch (error) {
      console.error('Error closing ticket:', error);
      await interaction.followUp({
         content: '❌ An error occurred while closing the ticket',
         ephemeral: true
      }).catch(() => { });
   }
}

/**
 * Marks a ticket as processing
 * @param {Interaction} interaction - The button interaction
 */
async function markAsProcessing(interaction) {
   const channel = interaction.channel;

   // Fix: More flexible ticket channel detection - works for both support and order tickets
   if (!channel.name.toLowerCase().includes('ticket-') &&
      !channel.name.toLowerCase().includes('support-') &&
      !channel.name.toLowerCase().includes('order-') &&
      !channel.name.toLowerCase().includes('roblox-dev-')) {
      return interaction.reply({
         content: '❌ This command can only be used in ticket or order channels',
         ephemeral: true
      });
   }

   // Check if user has permission (Den Lords only)
   const isDenLord = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
      interaction.member.roles.cache.some(r => r.name.toLowerCase() === 'den lord');

   if (!isDenLord) {
      return interaction.reply({
         content: '❌ Only Den Lords can mark tickets as processing',
         ephemeral: true
      });
   }

   try {
      // Update channel name to show it's being processed
      if (!channel.name.includes('⚙️')) {
         await channel.setName(`⚙️${channel.name}`);
      }
      // Move channel to processing category if configured
      const processingCategoryId = process.env.TICKETS_PROCESSING_CATEGORY;
      if (processingCategoryId) {
         try {
            const processingCategory = await interaction.guild.channels.fetch(processingCategoryId);
            if (processingCategory) {
               await channel.setParent(processingCategory.id, { lockPermissions: false });

               // Ensure the permissions remain the same (only ticket creator and admins)
               if (channel.name.includes('support-') || channel.name.includes('ticket-') || channel.name.includes('roblox-dev-')) {
                  // For support tickets, ensure admin-only permissions
                  const adminRoleId = process.env.ADMIN_ROLE_ID;
                  const ticketUserId = channel.topic?.split(':')[1]?.trim();

                  if (adminRoleId && ticketUserId) {
                     const permissionOverwrites = [
                        {
                           // Deny everyone by default
                           id: interaction.guild.id,
                           deny: [
                              PermissionFlagsBits.ViewChannel,
                              PermissionFlagsBits.SendMessages,
                              PermissionFlagsBits.ReadMessageHistory
                           ]
                        },
                        {
                           // Allow the ticket creator
                           id: ticketUserId,
                           allow: [
                              PermissionFlagsBits.ViewChannel,
                              PermissionFlagsBits.SendMessages,
                              PermissionFlagsBits.ReadMessageHistory,
                              PermissionFlagsBits.AddReactions
                           ]
                        },
                        {
                           // Allow admin role
                           id: adminRoleId,
                           allow: [
                              PermissionFlagsBits.ViewChannel,
                              PermissionFlagsBits.SendMessages,
                              PermissionFlagsBits.ReadMessageHistory,
                              PermissionFlagsBits.ManageMessages,
                              PermissionFlagsBits.ManageChannels,
                              PermissionFlagsBits.AddReactions
                           ]
                        }
                     ];

                     // Note: USER_ROLE_ID is intentionally not added to permissionOverwrites
                     // This ensures only the ticket creator and admins can see the ticket

                     await channel.permissionOverwrites.set(permissionOverwrites);
                  }
               }

               console.log(`Moved ${channel.name} to processing category`);
            }
         } catch (err) {
            console.error('Error moving to processing category:', err);
            // Continue execution even if moving fails
         }
      }

      // Get ticket creator
      const ticketUserId = channel.topic?.split(':')[1]?.trim();

      // Create processing message
      const processingEmbed = new EmbedBuilder()
         .setTitle('⚙️ Processing')
         .setDescription(`This is now being processed by ${interaction.user}`)
         .setColor(0x3498db) // Blue color
         .addFields([
            {
               name: 'Staff Member',
               value: `${interaction.user}`,
               inline: true
            },
            {
               name: 'Time',
               value: new Date().toLocaleString(),
               inline: true
            }
         ])
         .setFooter({ text: 'Staff will assist you shortly' })
         .setTimestamp();
      // Create new action row with buttons
      const actionRow = new ActionRowBuilder();

      if (channel.name.startsWith('order-')) {
         // Order buttons
         actionRow.addComponents(
            new ButtonBuilder()
               .setCustomId('order_complete')
               .setLabel('Complete Order')
               .setEmoji('✅')
               .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
               .setCustomId('ticket_unprocess')
               .setLabel('Unmark Processing')
               .setEmoji('⏹️')
               .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
               .setCustomId('claim_ticket')
               .setLabel('Claim Ticket')
               .setEmoji('🎯')
               .setStyle(ButtonStyle.Primary)
         );

         // Add payment methods button for orders
         const paymentButtonRow = new ActionRowBuilder()
            .addComponents(
               new ButtonBuilder()
                  .setCustomId('show_order_payment_methods')
                  .setLabel('Payment Methods')
                  .setEmoji('💳')
                  .setStyle(ButtonStyle.Secondary)
            );

         // Send processing notification with payment methods button
         await interaction.reply({
            embeds: [processingEmbed],
            components: [actionRow, paymentButtonRow]
         });
      } else {
         // Support ticket buttons (including roblox-dev-)
         actionRow.addComponents(
            new ButtonBuilder()
               .setCustomId('ticket_complete')
               .setLabel('Complete Ticket')
               .setEmoji('✅')
               .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
               .setCustomId('ticket_close')
               .setLabel('Close Ticket')
               .setEmoji('🔒')
               .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
               .setCustomId('ticket_unprocess')
               .setLabel('Unmark Processing')
               .setEmoji('⏹️')
               .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
               .setCustomId('claim_ticket')
               .setLabel('Claim Ticket')
               .setEmoji('🎯')
               .setStyle(ButtonStyle.Primary)
         );

         // Add payment methods button for tickets
         const paymentButtonRow = new ActionRowBuilder()
            .addComponents(
               new ButtonBuilder()
                  .setCustomId('show_payment_methods')
                  .setLabel('Payment Methods')
                  .setEmoji('💳')
                  .setStyle(ButtonStyle.Secondary)
            );

         // Send processing notification with payment methods button
         await interaction.reply({
            embeds: [processingEmbed],
            components: [actionRow, paymentButtonRow]
         });
      }

      // Log to ticket logs if configured
      const logsChannelId = process.env.TICKETS_LOGS_CHANNEL;
      if (logsChannelId) {
         try {
            const logsChannel = await interaction.client.channels.fetch(logsChannelId);
            if (logsChannel) {
               const logEmbed = new EmbedBuilder()
                  .setTitle(channel.name.startsWith('order-') ? 'Order Marked as Processing' : 'Ticket Marked as Processing')
                  .setDescription(`**Channel:** #${channel.name}\n**Staff:** ${interaction.user.tag}`)
                  .setColor(0x3498db)
                  .setTimestamp();

               await logsChannel.send({ embeds: [logEmbed] });
            }
         } catch (err) {
            console.error('Error sending to logs channel:', err);
         }
      }

   } catch (error) {
      console.error('Error marking as processing:', error);
      await interaction.reply({
         content: '❌ An error occurred while marking as processing',
         ephemeral: true
      });
   }
}

/**
 * Unmark a ticket as processing
 * @param {Interaction} interaction - The button interaction 
 */
async function unmarkProcessing(interaction) {
   const channel = interaction.channel;

   // Fix: More flexible ticket channel detection - works for both tickets
   if (!channel.name.toLowerCase().includes('ticket-') &&
      !channel.name.toLowerCase().includes('support-') &&
      !channel.name.toLowerCase().includes('order-') &&
      !channel.name.toLowerCase().includes('roblox-dev-')) {
      return interaction.reply({
         content: '❌ This command can only be used in ticket or order channels',
         ephemeral: true
      });
   }

   // Check permissions (Den Lords only)
   const isDenLord = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
      interaction.member.roles.cache.some(r => r.name.toLowerCase() === 'den lord');

   if (!isDenLord) {
      return interaction.reply({
         content: '❌ Only Den Lords can unmark tickets',
         ephemeral: true
      });
   }

   try {
      // Update channel name to remove processing icon
      if (channel.name.includes('⚙️')) {
         await channel.setName(channel.name.replace('⚙️', ''));
      }
      // Move channel back to open tickets category if configured
      const openCategoryId = process.env.TICKETS_OPEN_CATEGORY;
      if (openCategoryId) {
         try {
            const openCategory = await interaction.guild.channels.fetch(openCategoryId);
            if (openCategory) {
               await channel.setParent(openCategory.id, { lockPermissions: false });

               // Ensure the permissions remain the same (only ticket creator and admins)
               if (channel.name.includes('support-') || channel.name.includes('ticket-') || channel.name.includes('roblox-dev-')) {
                  // For support tickets, ensure that proper permissions are maintained
                  const adminRoleId = process.env.ADMIN_ROLE_ID;
                  const ticketUserId = channel.topic?.split(':')[1]?.trim();

                  if (adminRoleId && ticketUserId) {
                     const permissionOverwrites = [
                        {
                           // Deny everyone by default
                           id: interaction.guild.id,
                           deny: [
                              PermissionFlagsBits.ViewChannel,
                              PermissionFlagsBits.SendMessages,
                              PermissionFlagsBits.ReadMessageHistory
                           ]
                        },
                        {
                           // Allow the ticket creator
                           id: ticketUserId,
                           allow: [
                              PermissionFlagsBits.ViewChannel,
                              PermissionFlagsBits.SendMessages,
                              PermissionFlagsBits.ReadMessageHistory,
                              PermissionFlagsBits.AddReactions
                           ]
                        },
                        {
                           // Allow admin role
                           id: adminRoleId,
                           allow: [
                              PermissionFlagsBits.ViewChannel,
                              PermissionFlagsBits.SendMessages,
                              PermissionFlagsBits.ReadMessageHistory,
                              PermissionFlagsBits.ManageMessages,
                              PermissionFlagsBits.ManageChannels,
                              PermissionFlagsBits.AddReactions
                           ]
                        }
                     ];

                     // Note: USER_ROLE_ID is intentionally not added to permissionOverwrites
                     // This ensures only the ticket creator and admins can see the ticket

                     await channel.permissionOverwrites.set(permissionOverwrites);
                  }
               }

               console.log(`Moved ${channel.name} back to open category`);
            }
         } catch (err) {
            console.error('Error moving to open category:', err);
            // Continue execution even if moving fails
         }
      }

      const unprocessEmbed = new EmbedBuilder()
         .setTitle('Status Updated')
         .setDescription(`This is no longer marked as processing by ${interaction.user}`)
         .setColor(0x95a5a6) // Gray color
         .setTimestamp();
      // Create new action row with buttons
      const actionRow = new ActionRowBuilder();

      if (channel.name.startsWith('order-')) {
         // Order buttons
         actionRow.addComponents(
            new ButtonBuilder()
               .setCustomId('order_complete')
               .setLabel('Complete Order')
               .setEmoji('✅')
               .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
               .setCustomId('order_unprocess')
               .setLabel('Unmark Processing')
               .setEmoji('⏹️')
               .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
               .setCustomId('claim_ticket')
               .setLabel('Claim Ticket')
               .setEmoji('🎯')
               .setStyle(ButtonStyle.Primary)
         );

         // Add payment methods button for orders
         const paymentButtonRow = new ActionRowBuilder()
            .addComponents(
               new ButtonBuilder()
                  .setCustomId('show_order_payment_methods')
                  .setLabel('Payment Methods')
                  .setEmoji('💳')
                  .setStyle(ButtonStyle.Secondary)
            );

         await interaction.reply({
            embeds: [unprocessEmbed],
            components: [actionRow, paymentButtonRow]
         });
      } else {
         // Support ticket buttons (including roblox-dev-)
         actionRow.addComponents(
            new ButtonBuilder()
               .setCustomId('ticket_complete')
               .setLabel('Complete Ticket')
               .setEmoji('✅')
               .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
               .setCustomId('ticket_close')
               .setLabel('Close Ticket')
               .setEmoji('🔒')
               .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
               .setCustomId('ticket_process')
               .setLabel('Mark as Processing')
               .setEmoji('⚙️')
               .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
               .setCustomId('claim_ticket')
               .setLabel('Claim Ticket')
               .setEmoji('🎯')
               .setStyle(ButtonStyle.Primary)
         );

         // Add payment methods button for tickets
         const paymentButtonRow = new ActionRowBuilder()
            .addComponents(
               new ButtonBuilder()
                  .setCustomId('show_payment_methods')
                  .setLabel('Payment Methods')
                  .setEmoji('💳')
                  .setStyle(ButtonStyle.Secondary)
            );

         await interaction.reply({
            embeds: [unprocessEmbed],
            components: [actionRow, paymentButtonRow]
         });
      }

   } catch (error) {
      console.error('Error unmarking:', error);
      await interaction.reply({
         content: '❌ An error occurred while unmarking',
         ephemeral: true
      });
   }
}

/**
 * Claims a ticket for a staff member
 * @param {Interaction} interaction - The button interaction
 */
async function claimTicket(interaction) {
   const channel = interaction.channel;

   // Check if this is a ticket or order channel
   if (!channel.name.toLowerCase().includes('ticket-') &&
      !channel.name.toLowerCase().includes('support-') &&
      !channel.name.toLowerCase().includes('order-') &&
      !channel.name.toLowerCase().includes('roblox-dev-')) {
      return interaction.reply({
         content: '❌ This command can only be used in ticket or order channels',
         ephemeral: true
      });
   }

   // Check if user has permission (Den Lords only)
   const isDenLord = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
      interaction.member.roles.cache.some(r => r.name.toLowerCase() === 'den lord');

   if (!isDenLord) {
      return interaction.reply({
         content: '❌ Only Den Lords can claim tickets',
         ephemeral: true
      });
   }

   try {
      // Check if ticket is already claimed
      const existingClaim = channel.topic?.includes('CLAIMED BY:');
      if (existingClaim) {
         return interaction.reply({
            content: '❌ This ticket is already claimed by another staff member',
            ephemeral: true
         });
      }

      // Update channel topic to include claim information
      const originalTopic = channel.topic || '';
      const newTopic = originalTopic + ` | CLAIMED BY: ${interaction.user.id}`;

      await channel.setTopic(newTopic);

      // Create claim embed
      const claimEmbed = new EmbedBuilder()
         .setTitle('🎯 Ticket Claimed')
         .setDescription(`This ${channel.name.startsWith('order-') ? 'order' : 'ticket'} has been claimed by ${interaction.user}`)
         .setColor(0x27ae60) // Green color
         .setTimestamp();

      // Create new action row with updated buttons
      const actionRow = new ActionRowBuilder();

      if (channel.name.startsWith('order-')) {
         // Order buttons with claim status
         actionRow.addComponents(
            new ButtonBuilder()
               .setCustomId('order_complete')
               .setLabel('Complete Order')
               .setEmoji('✅')
               .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
               .setCustomId('order_unprocess')
               .setLabel('Unmark Processing')
               .setEmoji('⏹️')
               .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
               .setCustomId('unclaim_ticket')
               .setLabel('Unclaim')
               .setEmoji('🔓')
               .setStyle(ButtonStyle.Secondary)
         );

         // Add payment methods button for orders
         const paymentButtonRow = new ActionRowBuilder()
            .addComponents(
               new ButtonBuilder()
                  .setCustomId('show_order_payment_methods')
                  .setLabel('Payment Methods')
                  .setEmoji('💳')
                  .setStyle(ButtonStyle.Secondary)
            );

         // Send claim notification with payment methods button
         await interaction.reply({
            embeds: [claimEmbed],
            components: [actionRow, paymentButtonRow]
         });
      } else {
         // Support ticket buttons with claim status
         actionRow.addComponents(
            new ButtonBuilder()
               .setCustomId('ticket_complete')
               .setLabel('Complete Ticket')
               .setEmoji('✅')
               .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
               .setCustomId('ticket_close')
               .setLabel('Close Ticket')
               .setEmoji('🔒')
               .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
               .setCustomId('ticket_unprocess')
               .setLabel('Unmark Processing')
               .setEmoji('⏹️')
               .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
               .setCustomId('unclaim_ticket')
               .setLabel('Unclaim')
               .setEmoji('🔓')
               .setStyle(ButtonStyle.Secondary)
         );

         // Add payment methods button for tickets
         const paymentButtonRow = new ActionRowBuilder()
            .addComponents(
               new ButtonBuilder()
                  .setCustomId('show_payment_methods')
                  .setLabel('Payment Methods')
                  .setEmoji('💳')
                  .setStyle(ButtonStyle.Secondary)
            );

         // Send claim notification with payment methods button
         await interaction.reply({
            embeds: [claimEmbed],
            components: [actionRow, paymentButtonRow]
         });
      }

      // Log to ticket logs if configured
      const logsChannelId = process.env.TICKETS_LOGS_CHANNEL;
      if (logsChannelId) {
         try {
            const logsChannel = await interaction.client.channels.fetch(logsChannelId);
            if (logsChannel) {
               const logEmbed = new EmbedBuilder()
                  .setTitle(channel.name.startsWith('order-') ? 'Order Claimed' : 'Ticket Claimed')
                  .setDescription(`**Channel:** #${channel.name}\n**Claimed by:** ${interaction.user.tag}`)
                  .setColor(0x27ae60)
                  .setTimestamp();

               await logsChannel.send({ embeds: [logEmbed] });
            }
         } catch (err) {
            console.error('Error sending to logs channel:', err);
         }
      }

   } catch (error) {
      console.error('Error claiming ticket:', error);
      await interaction.reply({
         content: '❌ An error occurred while claiming the ticket',
         ephemeral: true
      });
   }
}

/**
 * Unclaims a ticket
 * @param {Interaction} interaction - The button interaction
 */
async function unclaimTicket(interaction) {
   const channel = interaction.channel;

   // Check if this is a ticket or order channel
   if (!channel.name.toLowerCase().includes('ticket-') &&
      !channel.name.toLowerCase().includes('support-') &&
      !channel.name.toLowerCase().includes('order-') &&
      !channel.name.toLowerCase().includes('roblox-dev-')) {
      return interaction.reply({
         content: '❌ This command can only be used in ticket or order channels',
         ephemeral: true
      });
   }

   // Check if user has permission (Den Lords only)
   const isDenLord = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
      interaction.member.roles.cache.some(r => r.name.toLowerCase() === 'den lord');

   if (!isDenLord) {
      return interaction.reply({
         content: '❌ Only Den Lords can unclaim tickets',
         ephemeral: true
      });
   }

   try {
      // Check if ticket is claimed and by whom
      const topic = channel.topic || '';
      const claimMatch = topic.match(/CLAIMED BY: (\d+)/);

      if (!claimMatch) {
         return interaction.reply({
            content: '❌ This ticket is not currently claimed',
            ephemeral: true
         });
      }

      const claimedByUserId = claimMatch[1];

      // Only the person who claimed it or an admin can unclaim it
      const adminRoleId = process.env.ADMIN_ROLE_ID;
      const isAdmin = adminRoleId && interaction.member.roles.cache.some(role =>
         role.id === adminRoleId
      );

      if (claimedByUserId !== interaction.user.id && !isAdmin) {
         return interaction.reply({
            content: '❌ Only the person who claimed this ticket or an admin can unclaim it',
            ephemeral: true
         });
      }

      // Remove claim from channel topic
      const newTopic = topic.replace(/ \| CLAIMED BY: \d+/, '');
      await channel.setTopic(newTopic);

      // Create unclaim embed
      const unclaimEmbed = new EmbedBuilder()
         .setTitle('🔓 Ticket Unclaimed')
         .setDescription(`This ${channel.name.startsWith('order-') ? 'order' : 'ticket'} has been unclaimed by ${interaction.user}`)
         .setColor(0x95a5a6) // Gray color
         .setTimestamp();

      // Create new action row with original buttons
      const actionRow = new ActionRowBuilder();

      if (channel.name.startsWith('order-')) {
         // Order buttons without claim
         actionRow.addComponents(
            new ButtonBuilder()
               .setCustomId('order_complete')
               .setLabel('Complete Order')
               .setEmoji('✅')
               .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
               .setCustomId('order_unprocess')
               .setLabel('Unmark Processing')
               .setEmoji('⏹️')
               .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
               .setCustomId('claim_ticket')
               .setLabel('Claim Ticket')
               .setEmoji('🎯')
               .setStyle(ButtonStyle.Primary)
         );

         // Add payment methods button for orders
         const paymentButtonRow = new ActionRowBuilder()
            .addComponents(
               new ButtonBuilder()
                  .setCustomId('show_order_payment_methods')
                  .setLabel('Payment Methods')
                  .setEmoji('💳')
                  .setStyle(ButtonStyle.Secondary)
            );

         // Send unclaim notification with payment methods button
         await interaction.reply({
            embeds: [unclaimEmbed],
            components: [actionRow, paymentButtonRow]
         });
      } else {
         // Support ticket buttons without claim
         actionRow.addComponents(
            new ButtonBuilder()
               .setCustomId('ticket_complete')
               .setLabel('Complete Ticket')
               .setEmoji('✅')
               .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
               .setCustomId('ticket_close')
               .setLabel('Close Ticket')
               .setEmoji('🔒')
               .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
               .setCustomId('ticket_unprocess')
               .setLabel('Unmark Processing')
               .setEmoji('⏹️')
               .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
               .setCustomId('claim_ticket')
               .setLabel('Claim Ticket')
               .setEmoji('🎯')
               .setStyle(ButtonStyle.Primary)
         );

         // Add payment methods button for tickets
         const paymentButtonRow = new ActionRowBuilder()
            .addComponents(
               new ButtonBuilder()
                  .setCustomId('show_payment_methods')
                  .setLabel('Payment Methods')
                  .setEmoji('💳')
                  .setStyle(ButtonStyle.Secondary)
            );

         // Send unclaim notification with payment methods button
         await interaction.reply({
            embeds: [unclaimEmbed],
            components: [actionRow, paymentButtonRow]
         });
      }

      // Log to ticket logs if configured
      const logsChannelId = process.env.TICKETS_LOGS_CHANNEL;
      if (logsChannelId) {
         try {
            const logsChannel = await interaction.client.channels.fetch(logsChannelId);
            if (logsChannel) {
               const logEmbed = new EmbedBuilder()
                  .setTitle(channel.name.startsWith('order-') ? 'Order Unclaimed' : 'Ticket Unclaimed')
                  .setDescription(`**Channel:** #${channel.name}\n**Unclaimed by:** ${interaction.user.tag}`)
                  .setColor(0x95a5a6)
                  .setTimestamp();

               await logsChannel.send({ embeds: [logEmbed] });
            }
         } catch (err) {
            console.error('Error sending to logs channel:', err);
         }
      }

   } catch (error) {
      console.error('Error unclaiming ticket:', error);
      await interaction.reply({
         content: '❌ An error occurred while unclaiming the ticket',
         ephemeral: true
      });
   }
}

module.exports = {
   sendCloseConfirmation,
   handleTicketClose,
   createTranscript,
   markAsProcessing,
   unmarkProcessing,
   claimTicket,
   unclaimTicket
};