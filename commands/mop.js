const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
   data: new SlashCommandBuilder()
      .setName('mop')
      .setDescription('Methods of Payment management and display')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand(subcommand =>
         subcommand
            .setName('add')
            .setDescription('Add a new payment method')
            .addStringOption(option =>
               option.setName('name')
                  .setDescription('Payment method name (e.g., PayPal, Cash App)')
                  .setRequired(true)
            )
            .addStringOption(option =>
               option.setName('details')
                  .setDescription('Payment details (email, username, etc.)')
                  .setRequired(true)
            )
            .addStringOption(option =>
               option.setName('notes')
                  .setDescription('Additional notes (optional)')
                  .setRequired(false)
            )
      )
      .addSubcommand(subcommand =>
         subcommand
            .setName('remove')
            .setDescription('Remove a payment method')
            .addStringOption(option =>
               option.setName('name')
                  .setDescription('Payment method name to remove')
                  .setRequired(true)
            )
      )
      .addSubcommand(subcommand =>
         subcommand
            .setName('list')
            .setDescription('List all payment methods')
      )
      .addSubcommand(subcommand =>
         subcommand
            .setName('show')
            .setDescription('Show payment methods in current channel')
      )
      .addSubcommand(subcommand =>
         subcommand
            .setName('edit')
            .setDescription('Edit an existing payment method')
            .addStringOption(option =>
               option.setName('name')
                  .setDescription('Payment method name to edit')
                  .setRequired(true)
            )
            .addStringOption(option =>
               option.setName('new_name')
                  .setDescription('New payment method name')
                  .setRequired(false)
            )
            .addStringOption(option =>
               option.setName('details')
                  .setDescription('New payment details')
                  .setRequired(false)
            )
            .addStringOption(option =>
               option.setName('notes')
                  .setDescription('New notes')
                  .setRequired(false)
            )
      )
      .addSubcommand(subcommand =>
         subcommand
            .setName('showall')
            .setDescription('Show all admins payment methods (admin only)')
      ),

   async execute(interaction, db) {
      const subcommand = interaction.options.getSubcommand();

      // Ensure the payment_methods table exists with admin_id field
      await new Promise((resolve, reject) => {
         db.run(`CREATE TABLE IF NOT EXISTS payment_methods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_id TEXT NOT NULL,
            name TEXT NOT NULL,
            details TEXT NOT NULL,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(admin_id, name)
         )`, (err) => {
            if (err) reject(err);
            else resolve();
         });
      });

      switch (subcommand) {
         case 'add':
            await handleAdd(interaction, db);
            break;
         case 'remove':
            await handleRemove(interaction, db);
            break;
         case 'list':
            await handleList(interaction, db);
            break;
         case 'show':
            await handleShow(interaction, db);
            break;
         case 'edit':
            await handleEdit(interaction, db);
            break;
         case 'showall':
            await handleShowAll(interaction, db);
            break;
      }
   }
};

async function handleAdd(interaction, db) {
   await interaction.deferReply({ ephemeral: true });

   try {
      const adminId = interaction.user.id;
      const name = interaction.options.getString('name');
      const details = interaction.options.getString('details');
      const notes = interaction.options.getString('notes') || '';

      // Check if payment method already exists for this admin
      const existing = await new Promise((resolve, reject) => {
         db.get('SELECT * FROM payment_methods WHERE admin_id = ? AND LOWER(name) = LOWER(?)', [adminId, name], (err, row) => {
            if (err) reject(err);
            else resolve(row);
         });
      });

      if (existing) {
         await interaction.editReply(`❌ Payment method "${name}" already exists for your account.`);
         return;
      }

      // Add new payment method for this admin
      await new Promise((resolve, reject) => {
         db.run(
            'INSERT INTO payment_methods (admin_id, name, details, notes) VALUES (?, ?, ?, ?)',
            [adminId, name, details, notes],
            function (err) {
               if (err) reject(err);
               else resolve(this.lastID);
            }
         );
      });

      const embed = new EmbedBuilder()
         .setTitle('✅ Payment Method Added')
         .setDescription(`Successfully added payment method: **${name}**`)
         .addFields(
            { name: 'Details', value: details, inline: false },
            { name: 'Notes', value: notes || 'None', inline: false },
            { name: 'Admin', value: `<@${adminId}>`, inline: false }
         )
         .setColor(0x2ecc71)
         .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

   } catch (error) {
      console.error('Error adding payment method:', error);
      await interaction.editReply('❌ Error adding payment method. Please try again.');
   }
}

async function handleRemove(interaction, db) {
   await interaction.deferReply({ ephemeral: true });

   try {
      const adminId = interaction.user.id;
      const name = interaction.options.getString('name');

      // Find the payment method for this admin (case-insensitive)
      const paymentMethod = await new Promise((resolve, reject) => {
         db.get('SELECT * FROM payment_methods WHERE admin_id = ? AND LOWER(name) = LOWER(?)', [adminId, name], (err, row) => {
            if (err) reject(err);
            else resolve(row);
         });
      });

      if (!paymentMethod) {
         await interaction.editReply(`❌ Payment method "${name}" not found for your account.`);
         return;
      }

      // Remove the payment method
      await new Promise((resolve, reject) => {
         db.run('DELETE FROM payment_methods WHERE id = ?', [paymentMethod.id], function (err) {
            if (err) reject(err);
            else resolve(this.changes);
         });
      });

      await interaction.editReply(`✅ Payment method "${paymentMethod.name}" has been removed from your account.`);

   } catch (error) {
      console.error('Error removing payment method:', error);
      await interaction.editReply('❌ Error removing payment method. Please try again.');
   }
}

async function handleList(interaction, db) {
   await interaction.deferReply({ ephemeral: true });

   try {
      const adminId = interaction.user.id;
      const paymentMethods = await new Promise((resolve, reject) => {
         db.all('SELECT * FROM payment_methods WHERE admin_id = ? ORDER BY name ASC', [adminId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
         });
      });

      if (paymentMethods.length === 0) {
         await interaction.editReply('📋 No payment methods configured for your account.');
         return;
      }

      const embed = new EmbedBuilder()
         .setTitle('💳 Your Payment Methods')
         .setDescription('Your configured payment methods:')
         .setColor(0x3498db)
         .setTimestamp();

      paymentMethods.forEach((method, index) => {
         embed.addFields({
            name: `${index + 1}. ${method.name}`,
            value: `**Details:** ${method.details}\n**Notes:** ${method.notes || 'None'}`,
            inline: false
         });
      });

      await interaction.editReply({ embeds: [embed] });

   } catch (error) {
      console.error('Error listing payment methods:', error);
      await interaction.editReply('❌ Error listing payment methods. Please try again.');
   }
}

async function handleShow(interaction, db) {
   try {
      const adminId = interaction.user.id;
      const paymentMethods = await new Promise((resolve, reject) => {
         db.all('SELECT * FROM payment_methods WHERE admin_id = ? ORDER BY name ASC', [adminId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
         });
      });

      if (paymentMethods.length === 0) {
         await interaction.reply({
            content: '📋 No payment methods configured for your account. Use `/mop add` to add payment methods.',
            ephemeral: true
         });
         return;
      }

      const embed = new EmbedBuilder()
         .setTitle('💳 Methods of Payment')
         .setDescription(`Payment methods for ${interaction.user.username}:`)
         .setColor(0x9b59b6)
         .setTimestamp()
         .setFooter({ text: 'Gambler\'s Den Payment Methods' });

      paymentMethods.forEach((method) => {
         embed.addFields({
            name: `${method.name}`,
            value: `**Details:** ${method.details}\n${method.notes ? `**Notes:** ${method.notes}` : ''}`,
            inline: false
         });
      });

      // Add a note about contacting staff
      embed.addFields({
         name: '📞 Need Help?',
         value: 'If you have any questions about payment methods, please contact our staff.',
         inline: false
      });

      await interaction.reply({ embeds: [embed] });

   } catch (error) {
      console.error('Error showing payment methods:', error);
      await interaction.reply({
         content: '❌ Error displaying payment methods. Please try again.',
         ephemeral: true
      });
   }
}

async function handleEdit(interaction, db) {
   await interaction.deferReply({ ephemeral: true });

   try {
      const adminId = interaction.user.id;
      const name = interaction.options.getString('name');
      const newName = interaction.options.getString('new_name');
      const newDetails = interaction.options.getString('details');
      const newNotes = interaction.options.getString('notes');

      // Check if at least one field is provided
      if (!newName && !newDetails && !newNotes) {
         await interaction.editReply('❌ Please provide at least one field to edit (new_name, details, or notes).');
         return;
      }

      // Find the payment method for this admin (case-insensitive)
      const paymentMethod = await new Promise((resolve, reject) => {
         db.get('SELECT * FROM payment_methods WHERE admin_id = ? AND LOWER(name) = LOWER(?)', [adminId, name], (err, row) => {
            if (err) reject(err);
            else resolve(row);
         });
      });

      if (!paymentMethod) {
         await interaction.editReply(`❌ Payment method "${name}" not found for your account.`);
         return;
      }

      // If changing the name, check for conflicts
      if (newName !== null && newName.toLowerCase() !== paymentMethod.name.toLowerCase()) {
         const existingWithNewName = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM payment_methods WHERE admin_id = ? AND LOWER(name) = LOWER(?)', [adminId, newName], (err, row) => {
               if (err) reject(err);
               else resolve(row);
            });
         });

         if (existingWithNewName) {
            await interaction.editReply(`❌ Payment method "${newName}" already exists for your account.`);
            return;
         }
      }

      // Update the payment method
      const finalName = newName !== null ? newName : paymentMethod.name;
      const finalDetails = newDetails !== null ? newDetails : paymentMethod.details;
      const finalNotes = newNotes !== null ? newNotes : paymentMethod.notes;

      await new Promise((resolve, reject) => {
         db.run(
            'UPDATE payment_methods SET name = ?, details = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [finalName, finalDetails, finalNotes, paymentMethod.id],
            function (err) {
               if (err) reject(err);
               else resolve(this.changes);
            }
         );
      });

      const embed = new EmbedBuilder()
         .setTitle('✅ Payment Method Updated')
         .setDescription(`Successfully updated payment method: **${paymentMethod.name}**`)
         .addFields(
            { name: 'Name', value: finalName, inline: false },
            { name: 'Details', value: finalDetails, inline: false },
            { name: 'Notes', value: finalNotes || 'None', inline: false },
            { name: 'Admin', value: `<@${adminId}>`, inline: false }
         )
         .setColor(0x2ecc71)
         .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

   } catch (error) {
      console.error('Error editing payment method:', error);
      await interaction.editReply('❌ Error editing payment method. Please try again.');
   }
}

async function handleShowAll(interaction, db) {
   await interaction.deferReply({ ephemeral: true });

   try {
      // Check if user is admin
      const adminRoleId = process.env.ADMIN_ROLE_ID;
      const isAdmin = adminRoleId && interaction.member.roles.cache.some(role =>
         role.id === adminRoleId
      );

      if (!isAdmin) {
         await interaction.editReply('❌ Only administrators can view all payment methods.');
         return;
      }

      const allPaymentMethods = await new Promise((resolve, reject) => {
         db.all('SELECT * FROM payment_methods ORDER BY admin_id, name ASC', (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
         });
      });

      if (allPaymentMethods.length === 0) {
         await interaction.editReply('📋 No payment methods configured by any admin.');
         return;
      }

      const embed = new EmbedBuilder()
         .setTitle('💳 All Payment Methods')
         .setDescription('Payment methods configured by all admins:')
         .setColor(0xe74c3c)
         .setTimestamp();

      // Group by admin
      const adminGroups = {};
      allPaymentMethods.forEach(method => {
         if (!adminGroups[method.admin_id]) {
            adminGroups[method.admin_id] = [];
         }
         adminGroups[method.admin_id].push(method);
      });

      for (const [adminId, methods] of Object.entries(adminGroups)) {
         const adminUser = await interaction.client.users.fetch(adminId).catch(() => ({ username: 'Unknown User' }));
         const adminName = adminUser.username || 'Unknown User';

         let methodsText = '';
         methods.forEach((method, index) => {
            methodsText += `${index + 1}. **${method.name}**: ${method.details}${method.notes ? ` (${method.notes})` : ''}\n`;
         });

         embed.addFields({
            name: `👤 ${adminName}`,
            value: methodsText,
            inline: false
         });
      }

      await interaction.editReply({ embeds: [embed] });

   } catch (error) {
      console.error('Error showing all payment methods:', error);
      await interaction.editReply('❌ Error displaying all payment methods. Please try again.');
   }
} 