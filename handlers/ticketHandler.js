const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const updateQueueEmbed = require('../utils/updateQueueEmbed');
const { getPaymentMethodsEmbed } = require('../utils/paymentMethods');

async function handleTicketComplete(interaction) {
   const adminRoleId = process.env.ADMIN_ROLE_ID;
   const isAdmin = adminRoleId && interaction.member.roles.cache.some(role =>
      role.id === adminRoleId
   );
   if (!isAdmin) {
      return interaction.reply({
         content: "❌ Only administrators can complete tickets.",
         ephemeral: true
      });
   }
   const channel = interaction.channel;
   if (!channel.name.includes('support-') && !channel.name.includes('ticket-') && !channel.name.includes('roblox-dev-')) {
      return await interaction.reply({
         content: '❌ This command can only be used in support ticket channels',
         ephemeral: true
      });
   }
   const completionEmbed = new EmbedBuilder()
      .setTitle('✅ Support Ticket Completed')
      .setDescription(`This support ticket has been completed by ${interaction.user}`)
      .setColor(0x2ecc71)
      .setTimestamp();
   await interaction.reply({ embeds: [completionEmbed] });
   const ticketCreatorId = channel.topic?.split(':')[1]?.trim();
   if (ticketCreatorId) {
      try {
         await channel.permissionOverwrites.edit(ticketCreatorId, {
            ViewChannel: false,
            SendMessages: false,
            ReadMessageHistory: false
         });
         console.log(`Removed access for ticket creator ${ticketCreatorId}`);
      } catch (err) {
         console.error('Error removing ticket creator access:', err);
      }
   }
   setTimeout(async () => {
      try {
         const ticketParts = channel.name.split('-');
         const ticketId = ticketParts.length >= 3 ? ticketParts.slice(2).join('-') : channel.name.replace(/^(support-|ticket-|roblox-dev-)/, '');
         const archivedCategoryId = process.env.TICKETS_ARCHIVED_CATEGORY;
         if (archivedCategoryId) {
            try {
               const archivedCategory = await interaction.guild.channels.fetch(archivedCategoryId);
               if (archivedCategory && archivedCategory.type === ChannelType.GuildCategory) {
                  await channel.setParent(archivedCategory.id, { lockPermissions: false });
                  await channel.permissionOverwrites.set([
                     {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                     },
                     {
                        id: adminRoleId,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                        deny: [PermissionFlagsBits.SendMessages]
                     }
                  ]);
                  await channel.setName(`completed-${ticketId}`);
                  console.log(`Moved ticket ${ticketId} to archived category`);
                  return;
               }
            } catch (err) {
               console.error('Error archiving ticket channel:', err);
            }
         }
         await channel.permissionOverwrites.set([
            {
               id: interaction.guild.id,
               deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
            },
            {
               id: adminRoleId,
               allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
               deny: [PermissionFlagsBits.SendMessages]
            }
         ]);
         await channel.setName(`completed-${ticketId}`);
      } catch (archiveError) {
         console.error('Error archiving channel:', archiveError);
      }
   }, 5000);
   await updateQueueEmbed(interaction.client);
}

async function markAsProcessing(interaction) {
   try {
      const channel = interaction.channel;
      if (!channel.name.startsWith('support-') && !channel.name.includes('order-') && !channel.name.startsWith('roblox-dev-')) {
         return interaction.reply({
            content: '❌ This command can only be used in ticket or order channels',
            ephemeral: true
         });
      }
      const adminRoleId = process.env.ADMIN_ROLE_ID;
      const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
         (adminRoleId && interaction.member.roles.cache.some(r => r.id === adminRoleId));
      if (!isAdmin) {
         return interaction.reply({
            content: '❌ Only administrators can mark tickets as processing',
            ephemeral: true
         });
      }
      const isTicket = channel.name.startsWith('support-') || channel.name.startsWith('roblox-dev-');
      const isOrder = channel.name.includes('order-');
      const processingCategoryId = process.env.TICKETS_PROCESSING_CATEGORY;
      let processingCategory = null;
      if (processingCategoryId) {
         try {
            const fetchedCategory = await interaction.guild.channels.fetch(processingCategoryId);
            if (fetchedCategory && fetchedCategory.type === ChannelType.GuildCategory) {
               processingCategory = fetchedCategory;
            } else {
               console.error(`Processing category ${processingCategoryId} exists but is not a category`);
            }
         } catch (err) {
            console.error('Error fetching processing category:', err);
         }
      }
      const oldName = channel.name;
      const newName = oldName.startsWith('⚙️') ? oldName : `⚙️${oldName}`;
      const processingEmbed = new EmbedBuilder()
         .setTitle(isTicket ? '⚙️ Ticket Processing' : '⚙️ Order Processing')
         .setDescription(`This ${isTicket ? 'ticket' : 'order'} is now being processed by ${interaction.user}`)
         .setColor(0x3498db)
         .setTimestamp();
      await interaction.reply({ embeds: [processingEmbed] });
      try {
         await channel.setName(newName);
         if (processingCategory) {
            await channel.setParent(processingCategory.id, {
               lockPermissions: false
            });
         }
      } catch (err) {
         console.error('Error updating channel:', err);
      }
      if (typeof updateQueueEmbed === 'function') {
         try {
            await updateQueueEmbed(interaction.client);
         } catch (err) {
            console.error('Error updating queue display:', err);
         }
      }
   } catch (error) {
      console.error('Error marking as processing:', error);
      try {
         await interaction.reply({
            content: `❌ An error occurred while marking as processing: ${error.message}`,
            ephemeral: true
         }).catch(console.error);
      } catch (replyError) {
         console.error('Error sending error message:', replyError);
      }
   }
}

async function unmarkProcessing(interaction) {
   try {
      const channel = interaction.channel;
      if (!channel.name.startsWith('⚙️support-') && !channel.name.startsWith('⚙️order-') &&
         !channel.name.startsWith('support-') && !channel.name.startsWith('order-') &&
         !channel.name.startsWith('⚙️roblox-dev-') && !channel.name.startsWith('roblox-dev-')) {
         return interaction.reply({
            content: '❌ This command can only be used in ticket or order channels',
            ephemeral: true
         });
      }
      const adminRoleId = process.env.ADMIN_ROLE_ID;
      const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
         (adminRoleId && interaction.member.roles.cache.some(r => r.id === adminRoleId));
      if (!isAdmin) {
         return interaction.reply({
            content: '❌ Only administrators can unmark tickets as processing',
            ephemeral: true
         });
      }
      const isTicket = channel.name.includes('support-') || channel.name.includes('roblox-dev-');
      const isOrder = channel.name.includes('order-');
      const openCategoryId = process.env.TICKETS_OPEN_CATEGORY;
      let openCategory = null;
      if (openCategoryId) {
         try {
            const fetchedCategory = await interaction.guild.channels.fetch(openCategoryId);
            if (fetchedCategory && fetchedCategory.type === ChannelType.GuildCategory) {
               openCategory = fetchedCategory;
            } else {
               console.error(`Open category ${openCategoryId} exists but is not a category`);
            }
         } catch (err) {
            console.error('Error fetching open category:', err);
         }
      }
      const oldName = channel.name;
      const newName = oldName.replace('⚙️', '');
      const unprocessingEmbed = new EmbedBuilder()
         .setTitle(isTicket ? '📝 Ticket Unprocessing' : '📝 Order Unprocessing')
         .setDescription(`This ${isTicket ? 'ticket' : 'order'} is no longer being processed`)
         .setColor(0xe67e22)
         .setTimestamp();
      await interaction.reply({ embeds: [unprocessingEmbed] });
      try {
         await channel.setName(newName);
         if (openCategory) {
            await channel.setParent(openCategory.id, {
               lockPermissions: false
            });
         }
      } catch (err) {
         console.error('Error updating channel:', err);
      }
      if (typeof updateQueueEmbed === 'function') {
         try {
            await updateQueueEmbed(interaction.client);
         } catch (err) {
            console.error('Error updating queue display:', err);
         }
      }
   } catch (error) {
      console.error('Error unmarking as processing:', error);
      try {
         await interaction.reply({
            content: `❌ An error occurred while unmarking as processing: ${error.message}`,
            ephemeral: true
         }).catch(console.error);
      } catch (replyError) {
         console.error('Error sending error message:', replyError);
      }
   }
}

async function showPaymentMethods(interaction, db) {
   try {
      const channel = interaction.channel;

      // Check if ticket is claimed by someone
      const topic = channel.topic || '';
      const claimMatch = topic.match(/CLAIMED BY: (\d+)/);

      let paymentMethodsEmbed;
      if (claimMatch) {
         // Show payment methods for the admin who claimed the ticket
         const claimedByAdminId = claimMatch[1];
         paymentMethodsEmbed = await getPaymentMethodsEmbed(db, claimedByAdminId);

         if (!paymentMethodsEmbed) {
            await interaction.reply({
               content: `📋 No payment methods configured for the admin who claimed this ticket.`,
               ephemeral: true
            });
            return;
         }

         // Update the embed title to show it's for the specific admin
         paymentMethodsEmbed.setTitle(`💳 Payment Methods - ${interaction.client.users.cache.get(claimedByAdminId)?.username || 'Admin'}`);
      } else {
         // Show all payment methods from all admins
         paymentMethodsEmbed = await getPaymentMethodsEmbed(db);

         if (!paymentMethodsEmbed) {
            await interaction.reply({
               content: '📋 No payment methods configured by any admin. Use `/mop add` to add payment methods.',
               ephemeral: true
            });
            return;
         }
      }

      await interaction.reply({ embeds: [paymentMethodsEmbed] });
   } catch (error) {
      console.error('Error showing payment methods:', error);
      await interaction.reply({
         content: '❌ Error displaying payment methods. Please try again.',
         ephemeral: true
      });
   }
}

module.exports = {
   handleTicketComplete,
   markAsProcessing,
   unmarkProcessing,
   showPaymentMethods
}; 