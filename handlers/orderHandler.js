// Order handling module for Discord bot
const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const updateQueueEmbed = require('../utils/updateQueueEmbed');
const updateStockEmbed = require('../utils/updateStockEmbed');
const { getPaymentMethodsEmbed } = require('../utils/paymentMethods');

// Smart matching utilities
function levenshteinDistance(str1, str2) {
   const matrix = [];
   const len1 = str1.length;
   const len2 = str2.length;
   for (let i = 0; i <= len2; i++) matrix[i] = [i];
   for (let j = 0; j <= len1; j++) matrix[0][j] = j;
   for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
         if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
         } else {
            matrix[i][j] = Math.min(
               matrix[i - 1][j - 1] + 1,
               matrix[i][j - 1] + 1,
               matrix[i - 1][j] + 1
            );
         }
      }
   }
   return matrix[len2][len1];
}
function calculateSimilarity(str1, str2) {
   const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
   const maxLength = Math.max(str1.length, str2.length);
   return ((maxLength - distance) / maxLength) * 100;
}
function isAcronym(acronym, fullName) {
   if (acronym.length < 2 || acronym.length > 5) return false;
   const words = fullName.toLowerCase().split(/\s+/);
   const acronymLower = acronym.toLowerCase();
   const firstLetters = words.map(word => word.charAt(0)).join('');
   if (firstLetters === acronymLower) return true;
   let acronymIndex = 0;
   for (const word of words) {
      if (acronymIndex >= acronymLower.length) break;
      if (word.startsWith(acronymLower[acronymIndex])) {
         acronymIndex++;
      }
   }
   return acronymIndex === acronymLower.length;
}
function findBestMatch(searchTerm, allItems) {
   const searchLower = searchTerm.toLowerCase().trim();
   let bestMatch = null;
   let bestScore = 0;
   for (const item of allItems) {
      const itemName = item.name.toLowerCase();
      if (itemName === searchLower) {
         return { item, score: 100, type: 'exact' };
      }
      if (itemName.includes(searchLower) || searchLower.includes(itemName)) {
         const score = Math.max(itemName.length, searchLower.length) / Math.min(itemName.length, searchLower.length) * 80;
         if (score > bestScore) {
            bestScore = score;
            bestMatch = { item, score, type: 'contains' };
         }
      }
      if (isAcronym(searchTerm, item.name)) {
         const score = 85;
         if (score > bestScore) {
            bestScore = score;
            bestMatch = { item, score, type: 'acronym' };
         }
      }
      const similarity = calculateSimilarity(searchTerm, item.name);
      if (similarity > 70 && similarity > bestScore) {
         bestScore = similarity;
         bestMatch = { item, score, type: 'fuzzy' };
      }
   }
   return bestMatch;
}

// Order handling functions (to be filled in next step)
async function handleOrderSubmit(interaction, db) {
   try {
      const guild = interaction.guild;
      await interaction.deferReply({ ephemeral: true });
      const orderNumber = Date.now();
      const itemsRaw = interaction.fields.getTextInputValue('orderItems');
      const specialRequests = interaction.fields.getTextInputValue('orderRequests') || '';

      // Parse the combined input to separate items, pets, and sheckles
      const lines = itemsRaw.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      const items = [];
      const pets = [];
      const sheckles = [];

      // Get all stock items (case-insensitive)
      const allItems = await new Promise((resolve, reject) => {
         db.all('SELECT * FROM stock', (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
         });
      });
      const stockNames = allItems.map(i => i.name.toLowerCase());

      console.log('Order creation debug: Raw input:', itemsRaw);
      console.log('Order creation debug: Available stock items:', stockNames);

      // Process each line
      for (const line of lines) {
         console.log('Order creation debug: Processing line:', line);
         // Split by commas and process each part
         const parts = line.split(',').map(part => part.trim()).filter(part => part.length > 0);
         console.log('Order creation debug: Split parts:', parts);

         for (const part of parts) {
            console.log('Order creation debug: Processing part:', part);
            // Remove common filler words and clean up the text
            let cleanedPart = part.toLowerCase()
               .replace(/\b(need|want|get|please|if you have|if u got|if available)\b/g, '')
               .replace(/\band\b/g, '')
               .trim();

            console.log('Order creation debug: Cleaned part:', cleanedPart);

            // Skip empty parts
            if (!cleanedPart) continue;

            // Sheckles detection
            if (cleanedPart.includes('sheckle')) {
               sheckles.push(part.trim());
               console.log('Order creation debug: Added to sheckles:', part.trim());
               continue;
            }

            // Try to match as item with various patterns
            // Pattern 1: "1 queen bee" or "1queen bee"
            let itemMatch = cleanedPart.match(/^(\d+)\s*([a-zA-Z\s]+)$/);

            // Pattern 2: "queen bee" (assume quantity 1)
            if (!itemMatch) {
               itemMatch = cleanedPart.match(/^([a-zA-Z\s]+)$/);
               if (itemMatch) {
                  itemMatch = [null, '1', itemMatch[1]];
               }
            }

            console.log('Order creation debug: Item match result:', itemMatch);

            if (itemMatch) {
               const itemName = itemMatch[2].trim();
               const quantity = parseInt(itemMatch[1], 10);
               console.log('Order creation debug: Attempting to match item:', itemName, 'quantity:', quantity);

               // First try exact match (case-insensitive)
               let stockIndex = stockNames.indexOf(itemName.toLowerCase());

               // If no exact match, try fuzzy matching
               if (stockIndex === -1) {
                  const bestMatch = findBestMatch(itemName, allItems);
                  if (bestMatch && bestMatch.score >= 70) { // Minimum similarity threshold
                     stockIndex = allItems.findIndex(i => i.name === bestMatch.item.name);
                     console.log(`Order creation debug: Fuzzy matched "${itemName}" to "${bestMatch.item.name}" (score: ${bestMatch.score})`);
                  }
               }

               if (stockIndex !== -1) {
                  items.push({
                     name: allItems[stockIndex].name,
                     quantity: quantity,
                     price: allItems[stockIndex].price
                  });
                  console.log('Order creation debug: Added item:', allItems[stockIndex].name);
                  continue;
               }
            }

            // If not matched as stock item, treat as pet
            pets.push(part.trim());
            console.log('Order creation debug: Added to pets:', part.trim());
         }
      }

      console.log('Order creation debug: Final items:', items);
      console.log('Order creation debug: Final pets:', pets);
      console.log('Order creation debug: Final sheckles:', sheckles);

      if (items.length === 0 && pets.length === 0 && sheckles.length === 0) {
         return await interaction.editReply({
            content: '❌ Please specify at least one valid item, pet, or sheckle in your order.',
            ephemeral: true
         });
      }

      let totalPrice = 0;
      let orderDetails = [];
      let unmatchedItems = [];
      // Process items
      if (items.length > 0) {
         for (const item of items) {
            const matchedItem = allItems.find(i => i.name.toLowerCase() === item.name.toLowerCase());
            if (matchedItem.quantity < item.quantity) {
               return await interaction.editReply({
                  content: `❌ Not enough stock for ${matchedItem.name}. Only ${matchedItem.quantity} left.`,
                  ephemeral: true
               });
            }
            totalPrice += matchedItem.price * item.quantity;
            orderDetails.push({
               name: matchedItem.name,
               quantity: item.quantity,
               price: matchedItem.price,
               subtotal: matchedItem.price * item.quantity
            });
         }
      }

      const channelOptions = {
         name: `order-${interaction.user.username}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
         type: ChannelType.GuildText,
         topic: `Order #${orderNumber} by ${interaction.user.tag}: ${interaction.user.id}`,
         reason: `Order placed by ${interaction.user.tag}`,
         permissionOverwrites: [
            {
               id: interaction.guild.id,
               deny: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory
               ]
            },
            {
               id: interaction.user.id,
               allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.AddReactions
               ]
            }
         ]
      };

      const adminRoleId = process.env.ADMIN_ROLE_ID;
      if (adminRoleId) {
         channelOptions.permissionOverwrites.push({
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

      const openCategoryId = process.env.TICKETS_OPEN_CATEGORY;
      let orderCategory = null;
      if (openCategoryId) {
         try {
            const fetchedCategory = await guild.channels.fetch(openCategoryId);
            if (fetchedCategory && fetchedCategory.type === ChannelType.GuildCategory) {
               orderCategory = fetchedCategory;
            } else {
               console.error(`Channel ${openCategoryId} exists but is not a category. Order will NOT be created.`);
               return await interaction.editReply({
                  content: '❌ Order category misconfiguration. Please contact an admin.',
                  ephemeral: true
               });
            }
         } catch (err) {
            console.error('Error fetching open order category:', err);
            return await interaction.editReply({
               content: '❌ Could not find the order category. Please contact an admin.',
               ephemeral: true
            });
         }
      } else {
         return await interaction.editReply({
            content: '❌ Order category is not set in the .env file. Please contact an admin.',
            ephemeral: true
         });
      }

      const orderChannel = await guild.channels.create({
         ...channelOptions,
         parent: orderCategory.id
      });

      // Create order embed with all fields
      const orderEmbed = new EmbedBuilder()
         .setTitle(`Order #${orderNumber}`)
         .setDescription(`Order placed by ${interaction.user}`)
         .setColor(0xf39c12)
         .setTimestamp();

      // Add items if any exist
      if (orderDetails.length > 0) {
         orderDetails.forEach(od => {
            orderEmbed.addFields({
               name: `${od.quantity} x ${od.name}`,
               value: `@ $${od.price.toLocaleString()} each = $${od.subtotal.toLocaleString()}`,
               inline: false
            });
         });
         orderEmbed.addFields({ name: 'Total Price', value: `$${totalPrice.toLocaleString()}` });
      }

      // Add pets field if provided
      if (pets.length > 0) {
         orderEmbed.addFields({
            name: 'Pets',
            value: pets.join('\n'),
            inline: false
         });
      }

      // Add sheckles field if provided
      if (sheckles.length > 0) {
         orderEmbed.addFields({
            name: 'Sheckles (Trillions)',
            value: sheckles.join('\n'),
            inline: false
         });
      }

      // Add special requests field if provided
      if (specialRequests.trim()) {
         orderEmbed.addFields({
            name: '📝 Special Requests',
            value: specialRequests.trim(),
            inline: false
         });
      }

      const buttonRow = new ActionRowBuilder()
         .addComponents(
            new ButtonBuilder()
               .setCustomId('order_processing')
               .setLabel('Mark as Processing')
               .setEmoji('⚙️')
               .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
               .setCustomId('order_unprocessing')
               .setLabel('Unmark Processing')
               .setEmoji('📝')
               .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
               .setCustomId('order_complete')
               .setLabel('Complete Order')
               .setEmoji('✅')
               .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
               .setCustomId('order_cancel')
               .setLabel('Cancel Order')
               .setEmoji('❌')
               .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
               .setCustomId('claim_ticket')
               .setLabel('Claim Ticket')
               .setEmoji('🎯')
               .setStyle(ButtonStyle.Primary)
         );

      await orderChannel.send({
         content: `${interaction.user} Your order has been created!`,
         embeds: [orderEmbed],
         components: [buttonRow]
      });

      // Create confirmation message
      let confirmationMessage = '✅ Your order has been created!\n\n';

      if (orderDetails.length > 0) {
         const orderSummary = orderDetails.map(od => `${od.quantity}x ${od.name}`).join(', ');
         confirmationMessage += `🛒 Items: ${orderSummary}\n`;
      }

      if (pets.length > 0) {
         confirmationMessage += `Pets: ${pets.join(', ')}\n`;
      }

      if (sheckles.length > 0) {
         confirmationMessage += `Sheckles (Trillions): ${sheckles.join(', ')}\n`;
      }

      confirmationMessage += `\nPlease check ${orderChannel} for details and updates.`;

      await interaction.editReply({
         content: confirmationMessage,
         ephemeral: true
      }).catch(err => console.error("Error editing reply:", err));

      if (typeof updateQueueEmbed === 'function') {
         updateQueueEmbed(interaction.client).catch(err => {
            console.error('Error updating queue display:', err);
         });
      }
   } catch (error) {
      console.error('Error creating order:', error);
      await interaction.editReply({
         content: `❌ Error creating order: ${error.message}`,
         ephemeral: true
      });
   }
}

async function handleOrderComplete(interaction, db) {
   // Check if user has admin role
   const adminRoleId = process.env.ADMIN_ROLE_ID;
   const isAdmin = adminRoleId && interaction.member.roles.cache.some(role =>
      role.id === adminRoleId
   );

   if (!isAdmin) {
      return interaction.reply({
         content: "❌ Only administrators can complete orders.",
         ephemeral: true
      });
   }

   // Get order information from the channel
   const channel = interaction.channel;

   // Check if this is an order channel - now works with both order- and ⚙️order- prefixes
   if (!channel.name.includes('order-')) {
      return await interaction.reply({
         content: '❌ This command can only be used in order channels',
         ephemeral: true
      });
   }

   // Get the order messages to extract details
   const messages = await channel.messages.fetch({ limit: 50 });
   const orderMessage = messages.find(m =>
      m.embeds.length > 0 &&
      m.embeds[0].data &&
      m.embeds[0].data.title &&
      m.embeds[0].data.title.startsWith('Order #')
   );

   let itemFields = [];
   let warning = '';

   if (!orderMessage || !orderMessage.embeds[0]) {
      warning = '⚠️ Order embed not found. Completing order anyway. No stock will be updated.';
   } else {
      // Extract item and quantity from the embed
      const orderEmbed = orderMessage.embeds[0];
      // Extract all item fields (fields with names like '2 x item name')
      itemFields = orderEmbed.data.fields ? orderEmbed.data.fields.filter(f => /\d+ x .+/i.test(f.name)) : [];
   }

   // Update the stock in the database for each item (only if there are stock items)
   if (itemFields && itemFields.length > 0) {
      try {
         for (const field of itemFields) {
            // Parse quantity and item name from field.name (e.g., '2 x item name')
            const match = field.name.match(/(\d+) x (.+)/i);
            if (!match) continue;
            const quantity = parseInt(match[1], 10);
            const item = match[2].trim();
            if (isNaN(quantity) || !item) continue;
            await new Promise((resolve, reject) => {
               db.run(
                  `UPDATE stock SET quantity = quantity - ? WHERE LOWER(name) = LOWER(?)`,
                  [quantity, item],
                  function (err) {
                     if (err) reject(err);
                     else if (this.changes === 0) reject(new Error(`Item not found or no changes made for ${item}`));
                     else resolve(this.changes);
                  }
               );
            });
         }
      } catch (dbError) {
         console.error('Database error:', dbError);
         return await interaction.reply({
            content: `❌ Failed to update inventory. ${dbError.message}`,
            ephemeral: true
         });
      }
   }

   // Send completion message
   const completionEmbed = new EmbedBuilder()
      .setTitle('✅ Order Completed')
      .setDescription(`This order has been completed by ${interaction.user}` + (warning ? `\n\n${warning}` : ''))
      .setColor(0x2ecc71) // Green color
      .setTimestamp();

   await interaction.reply({ embeds: [completionEmbed] });

   // Get the order creator's ID from the channel topic
   const orderCreatorId = channel.topic?.split(':')[1]?.trim();

   // Immediately remove the order creator's access
   if (orderCreatorId) {
      try {
         await channel.permissionOverwrites.edit(orderCreatorId, {
            ViewChannel: false,
            SendMessages: false,
            ReadMessageHistory: false
         });
         console.log(`Removed access for order creator ${orderCreatorId}`);
      } catch (err) {
         console.error('Error removing order creator access:', err);
      }
   }

   // Update the stock embed display if that function exists
   if (typeof updateStockEmbed === 'function') {
      await updateStockEmbed(interaction.client, db).catch(err => {
         console.error('Failed to update stock embed:', err);
      });
   }

   // Wait 5 seconds before archiving the channel (reduced from 15 seconds)
   setTimeout(async () => {
      try {
         // Extract the random ID from the channel name (format: order-username-XXXXX)
         const orderParts = channel.name.split('-');
         const orderId = orderParts.length >= 3 ? orderParts.slice(2).join('-') : channel.name.replace('order-', '');

         // Try to move to archived category if it exists
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

                  await channel.setName(`completed-${orderId}`);
                  console.log(`Moved order ${orderId} to archived category`);
                  return;
               }
            } catch (err) {
               console.error('Error archiving order channel:', err);
            }
         }

         // If no archive category or moving failed, just make it read-only and admin-only
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
         await channel.setName(`completed-${orderId}`);
      } catch (archiveError) {
         console.error('Error archiving channel:', archiveError);
      }
   }, 5000);

   await updateQueueEmbed(interaction.client);
}

async function handleOrderCancel(interaction) {
   // Check if user has admin role or is the order creator
   const channel = interaction.channel;
   const adminRoleId = process.env.ADMIN_ROLE_ID;
   const isAdmin = adminRoleId && interaction.member.roles.cache.some(role =>
      role.id === adminRoleId
   );

   // Check if this is an order channel - now works with both order- and ⚙️order- prefixes
   if (!channel.name.includes('order-')) {
      return await interaction.reply({
         content: '❌ This command can only be used in order channels',
         ephemeral: true
      });
   }

   const orderCreatorId = channel.topic?.split(':')[1]?.trim();
   const isOrderCreator = orderCreatorId === interaction.user.id;

   if (!isAdmin && !isOrderCreator) {
      return interaction.reply({
         content: "❌ Only administrators or the order creator can cancel orders.",
         ephemeral: true
      });
   }

   // Send confirmation before cancelling
   const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
         .setCustomId('order_cancel_confirm')
         .setLabel('Confirm Cancellation')
         .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
         .setCustomId('order_cancel_abort')
         .setLabel('Keep Order')
         .setStyle(ButtonStyle.Secondary)
   );

   await interaction.reply({
      content: '⚠️ Are you sure you want to cancel this order? This action cannot be undone.',
      components: [confirmRow],
      ephemeral: false
   });
}

async function handleOrderCancelConfirm(interaction) {
   // Check if user has admin role or is the order creator
   const channel = interaction.channel;
   const adminRoleId = process.env.ADMIN_ROLE_ID;
   const isAdmin = adminRoleId && interaction.member.roles.cache.some(role =>
      role.id === adminRoleId
   );

   // Check if this is an order channel - not necessary for this function but added for consistency
   if (!channel.name.includes('order-')) {
      return await interaction.reply({
         content: '❌ This command can only be used in order channels',
         ephemeral: true
      });
   }

   const orderCreatorId = channel.topic?.split(':')[1]?.trim();
   const isOrderCreator = orderCreatorId === interaction.user.id;

   if (!isAdmin && !isOrderCreator) {
      return interaction.reply({
         content: "❌ Only administrators or the order creator can cancel orders.",
         ephemeral: true
      });
   }

   await interaction.update({ content: 'Cancelling order...', components: [] });

   // Send cancellation message
   const cancellationEmbed = new EmbedBuilder()
      .setTitle('❌ Order Cancelled')
      .setDescription(`This order has been cancelled by ${interaction.user}`)
      .setColor(0xe74c3c) // Red color
      .setTimestamp();

   await channel.send({ embeds: [cancellationEmbed] });

   // Wait 10 seconds before deleting the channel
   setTimeout(async () => {
      try {
         await channel.delete('Order cancelled');
      } catch (err) {
         console.error('Error deleting order channel:', err);
         // If deletion fails, try to just rename it
         try {
            // Extract the random ID from the channel name (format: order-username-XXXXX)
            const orderParts = channel.name.split('-');
            const orderId = orderParts.length >= 3 ? orderParts.slice(2).join('-') : channel.name.replace('order-', '');
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
            await channel.setName(`cancelled-${orderId}`);
         } catch (renameErr) {
            console.error('Error renaming cancelled channel:', renameErr);
         }
      }
   }, 10000);

   await updateQueueEmbed(interaction.client);
}

async function showPaymentMethods(interaction, db) {
   try {
      const channel = interaction.channel;

      // Check if order is claimed by someone
      const topic = channel.topic || '';
      const claimMatch = topic.match(/CLAIMED BY: (\d+)/);

      let paymentMethodsEmbed;
      if (claimMatch) {
         // Show payment methods for the admin who claimed the order
         const claimedByAdminId = claimMatch[1];
         paymentMethodsEmbed = await getPaymentMethodsEmbed(db, claimedByAdminId);

         if (!paymentMethodsEmbed) {
            await interaction.reply({
               content: `📋 No payment methods configured for the admin who claimed this order.`,
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
   handleOrderSubmit,
   handleOrderComplete,
   handleOrderCancel,
   handleOrderCancelConfirm,
   showPaymentMethods,
   levenshteinDistance,
   calculateSimilarity,
   isAcronym,
   findBestMatch
}; 