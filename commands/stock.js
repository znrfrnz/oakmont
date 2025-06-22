const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const updateStockEmbed = require('../utils/updateStockEmbed');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

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

      // Exact match
      if (itemName === searchLower) {
         return { item, score: 100, type: 'exact' };
      }

      // Contains match
      if (itemName.includes(searchLower) || searchLower.includes(itemName)) {
         const score = Math.max(itemName.length, searchLower.length) / Math.min(itemName.length, searchLower.length) * 80;
         if (score > bestScore) {
            bestScore = score;
            bestMatch = { item, score, type: 'contains' };
         }
      }

      // Acronym match
      if (isAcronym(searchTerm, item.name)) {
         const score = 85;
         if (score > bestScore) {
            bestScore = score;
            bestMatch = { item, score, type: 'acronym' };
         }
      }

      // Fuzzy match
      const similarity = calculateSimilarity(searchTerm, item.name);
      if (similarity > 70 && similarity > bestScore) {
         bestScore = similarity;
         bestMatch = { item, score, type: 'fuzzy' };
      }
   }

   return bestMatch;
}

module.exports = {
   data: new SlashCommandBuilder()
      .setName('stock')
      .setDescription('Stock management commands')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand(subcommand =>
         subcommand
            .setName('update')
            .setDescription('Update the stock embed display')
      )
      .addSubcommand(subcommand =>
         subcommand
            .setName('add')
            .setDescription('Add a new item to stock')
            .addStringOption(option =>
               option.setName('name')
                  .setDescription('Item name')
                  .setRequired(true)
            )
            .addNumberOption(option =>
               option.setName('price')
                  .setDescription('Item price')
                  .setRequired(true)
                  .setMinValue(0)
            )
            .addIntegerOption(option =>
               option.setName('quantity')
                  .setDescription('Item quantity')
                  .setRequired(true)
                  .setMinValue(0)
            )
      )
      .addSubcommand(subcommand =>
         subcommand
            .setName('remove')
            .setDescription('Remove an item from stock')
            .addStringOption(option =>
               option.setName('name')
                  .setDescription('Item name')
                  .setRequired(true)
            )
      )
      .addSubcommand(subcommand =>
         subcommand
            .setName('list')
            .setDescription('List all items in stock')
      )
      .addSubcommand(subcommand =>
         subcommand
            .setName('edit')
            .setDescription('Edit an existing item in stock')
            .addStringOption(option =>
               option.setName('name')
                  .setDescription('Item name to edit')
                  .setRequired(true)
            )
            .addNumberOption(option =>
               option.setName('price')
                  .setDescription('New price (leave empty to keep current)')
                  .setMinValue(0)
            )
            .addIntegerOption(option =>
               option.setName('quantity')
                  .setDescription('New quantity (leave empty to keep current)')
                  .setMinValue(0)
            )
      ),

   async execute(interaction, db) {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
         case 'update':
            await interaction.deferReply({ ephemeral: true });
            try {
               await updateStockEmbed(interaction.client, db);
               await interaction.editReply('✅ Stock embed updated successfully!');
            } catch (error) {
               console.error('Error updating stock embed:', error);
               await interaction.editReply('❌ Error updating stock embed. Check console for details.');
            }
            break;

         case 'add':
            await interaction.deferReply({ ephemeral: true });
            try {
               const name = interaction.options.getString('name');
               const price = interaction.options.getNumber('price');
               const quantity = interaction.options.getInteger('quantity');

               await new Promise((resolve, reject) => {
                  db.run(
                     'INSERT OR REPLACE INTO stock (name, price, quantity) VALUES (?, ?, ?)',
                     [name, price, quantity],
                     function (err) {
                        if (err) reject(err);
                        else resolve(this.changes);
                     }
                  );
               });

               await updateStockEmbed(interaction.client, db);
               await interaction.editReply(`✅ Added **${name}** to stock: $${price.toLocaleString()} x ${quantity}`);
            } catch (error) {
               console.error('Error adding item:', error);
               await interaction.editReply('❌ Error adding item to stock.');
            }
            break;

         case 'remove':
            await interaction.deferReply({ ephemeral: true });
            try {
               const searchTerm = interaction.options.getString('name');

               // Get all items for smart matching
               const allItems = await new Promise((resolve, reject) => {
                  db.all('SELECT * FROM stock ORDER BY name ASC', (err, rows) => {
                     if (err) reject(err);
                     else resolve(rows || []);
                  });
               });

               if (allItems.length === 0) {
                  await interaction.editReply('📦 No items in stock to remove.');
                  return;
               }

               // Find the best match
               const match = findBestMatch(searchTerm, allItems);

               if (!match || match.score < 70) {
                  const suggestions = allItems
                     .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
                     .slice(0, 5)
                     .map(item => `• ${item.name}`)
                     .join('\n');

                  await interaction.editReply(
                     `❌ Item **"${searchTerm}"** not found.\n\n` +
                     (suggestions ? `**Did you mean:**\n${suggestions}` : '**Available items:**\n' + allItems.map(item => `• ${item.name}`).join('\n'))
                  );
                  return;
               }

               const matchedItem = match.item;

               // If it's not an exact match, ask for confirmation
               if (match.type !== 'exact') {
                  const confirmationMessage =
                     `🔍 **Smart Match Found:**\n` +
                     `You searched for: **"${searchTerm}"**\n` +
                     `Matched to: **"${matchedItem.name}"**\n` +
                     `Match type: **${match.type}** (${Math.round(match.score)}% confidence)\n\n` +
                     `💰 Price: **$${matchedItem.price.toLocaleString()}**\n` +
                     `📦 Quantity: **${matchedItem.quantity}**\n\n` +
                     `Are you sure you want to remove this item? Use \`/stock remove name:"${matchedItem.name}"\` to confirm.`;

                  const row = new ActionRowBuilder().addComponents(
                     new ButtonBuilder()
                        .setCustomId('stock_remove_confirm')
                        .setLabel('Yes')
                        .setStyle(ButtonStyle.Success),
                     new ButtonBuilder()
                        .setCustomId('stock_remove_cancel')
                        .setLabel('No')
                        .setStyle(ButtonStyle.Danger)
                  );

                  await interaction.editReply({ content: confirmationMessage, components: [row] });
                  return;
               }

               // Exact match - proceed with removal
               const result = await new Promise((resolve, reject) => {
                  db.run('DELETE FROM stock WHERE name = ?', [matchedItem.name], function (err) {
                     if (err) reject(err);
                     else resolve(this.changes);
                  });
               });

               if (result > 0) {
                  await updateStockEmbed(interaction.client, db);
                  await interaction.editReply(`✅ Removed **${matchedItem.name}** from stock.`);
               } else {
                  await interaction.editReply(`❌ Item **${matchedItem.name}** not found in stock.`);
               }
            } catch (error) {
               console.error('Error removing item:', error);
               await interaction.editReply('❌ Error removing item from stock.');
            }
            break;

         case 'list':
            await interaction.deferReply({ ephemeral: true });
            try {
               const items = await new Promise((resolve, reject) => {
                  db.all('SELECT * FROM stock ORDER BY name ASC', (err, rows) => {
                     if (err) reject(err);
                     else resolve(rows || []);
                  });
               });

               if (items.length === 0) {
                  await interaction.editReply('📦 No items in stock.');
               } else {
                  let listText = '**Current Stock:**\n\n';
                  items.forEach(item => {
                     const status = item.quantity > 0 ? '🟢' : '❌';
                     listText += `${status} **${item.name}**\n`;
                     listText += `   💰 Price: $${item.price.toLocaleString()}\n`;
                     listText += `   📦 Quantity: ${item.quantity}\n\n`;
                  });

                  await interaction.editReply(listText);
               }
            } catch (error) {
               console.error('Error listing items:', error);
               await interaction.editReply('❌ Error listing stock items.');
            }
            break;

         case 'edit':
            await interaction.deferReply({ ephemeral: true });
            try {
               const searchTerm = interaction.options.getString('name');
               const newPrice = interaction.options.getNumber('price');
               const newQuantity = interaction.options.getInteger('quantity');

               // Check if at least one field is provided
               if (newPrice === null && newQuantity === null) {
                  await interaction.editReply('❌ Please provide at least one field to edit (price or quantity).');
                  return;
               }

               // Get all items for smart matching
               const allItems = await new Promise((resolve, reject) => {
                  db.all('SELECT * FROM stock ORDER BY name ASC', (err, rows) => {
                     if (err) reject(err);
                     else resolve(rows || []);
                  });
               });

               if (allItems.length === 0) {
                  await interaction.editReply('📦 No items in stock to edit.');
                  return;
               }

               // Find the best match
               const match = findBestMatch(searchTerm, allItems);

               if (!match || match.score < 70) {
                  const suggestions = allItems
                     .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
                     .slice(0, 5)
                     .map(item => `• ${item.name}`)
                     .join('\n');

                  await interaction.editReply(
                     `❌ Item **"${searchTerm}"** not found.\n\n` +
                     (suggestions ? `**Did you mean:**\n${suggestions}` : '**Available items:**\n' + allItems.map(item => `• ${item.name}`).join('\n'))
                  );
                  return;
               }

               const matchedItem = match.item;

               // If it's not an exact match, ask for confirmation
               if (match.type !== 'exact') {
                  const confirmationMessage =
                     `🔍 **Smart Match Found:**\n` +
                     `You searched for: **"${searchTerm}"**\n` +
                     `Matched to: **"${matchedItem.name}"**\n` +
                     `Match type: **${match.type}** (${Math.round(match.score)}% confidence)\n\n` +
                     `💰 Current Price: **$${matchedItem.price.toLocaleString()}**\n` +
                     `📦 Current Quantity: **${matchedItem.quantity}**\n\n` +
                     `Are you sure you want to edit this item? Use \`/stock edit name:"${matchedItem.name}"\` to confirm.`;

                  const row = new ActionRowBuilder().addComponents(
                     new ButtonBuilder()
                        .setCustomId('stock_edit_confirm')
                        .setLabel('Yes')
                        .setStyle(ButtonStyle.Success),
                     new ButtonBuilder()
                        .setCustomId('stock_edit_cancel')
                        .setLabel('No')
                        .setStyle(ButtonStyle.Danger)
                  );

                  await interaction.editReply({ content: confirmationMessage, components: [row] });
                  return;
               }

               // Exact match - proceed with editing
               const finalPrice = newPrice !== null ? newPrice : matchedItem.price;
               const finalQuantity = newQuantity !== null ? newQuantity : matchedItem.quantity;

               const result = await new Promise((resolve, reject) => {
                  db.run(
                     'UPDATE stock SET price = ?, quantity = ? WHERE name = ?',
                     [finalPrice, finalQuantity, matchedItem.name],
                     function (err) {
                        if (err) reject(err);
                        else resolve(this.changes);
                     }
                  );
               });

               if (result > 0) {
                  await updateStockEmbed(interaction.client, db);

                  let editMessage = `✅ Updated **${matchedItem.name}**:\n`;
                  if (newPrice !== null) {
                     editMessage += `💰 Price: $${matchedItem.price.toLocaleString()} → **$${finalPrice.toLocaleString()}**\n`;
                  }
                  if (newQuantity !== null) {
                     editMessage += `📦 Quantity: ${matchedItem.quantity} → **${finalQuantity}**\n`;
                  }

                  await interaction.editReply(editMessage);
               } else {
                  await interaction.editReply(`❌ Item **${matchedItem.name}** not found in stock.`);
               }
            } catch (error) {
               console.error('Error editing item:', error);
               await interaction.editReply('❌ Error editing item in stock.');
            }
            break;
      }
   },
};
