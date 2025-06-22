const { EmbedBuilder } = require('discord.js');

/**
 * Get payment methods embed for display in tickets/orders
 * @param {Object} db - Database connection
 * @param {string} adminId - Admin ID to get payment methods for (optional, defaults to all)
 * @returns {Promise<EmbedBuilder|null>} - Payment methods embed or null if no methods
 */
async function getPaymentMethodsEmbed(db, adminId = null) {
   try {
      let paymentMethods;
      if (adminId) {
         // Get payment methods for specific admin
         paymentMethods = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM payment_methods WHERE admin_id = ? ORDER BY name ASC', [adminId], (err, rows) => {
               if (err) reject(err);
               else resolve(rows || []);
            });
         });
      } else {
         // Get all payment methods from all admins
         paymentMethods = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM payment_methods ORDER BY admin_id, name ASC', (err, rows) => {
               if (err) reject(err);
               else resolve(rows || []);
            });
         });
      }

      if (paymentMethods.length === 0) {
         return null;
      }

      const embed = new EmbedBuilder()
         .setTitle('💳 Methods of Payment')
         .setDescription('Please use one of the following payment methods:')
         .setColor(0x9b59b6)
         .setTimestamp()
         .setFooter({ text: 'Gambler\'s Den Payment Methods' });

      if (adminId) {
         // Single admin - show methods directly
         paymentMethods.forEach((method) => {
            embed.addFields({
               name: `${method.name}`,
               value: `**Details:** ${method.details}\n${method.notes ? `**Notes:** ${method.notes}` : ''}`,
               inline: false
            });
         });
      } else {
         // Multiple admins - group by admin
         const adminGroups = {};
         paymentMethods.forEach(method => {
            if (!adminGroups[method.admin_id]) {
               adminGroups[method.admin_id] = [];
            }
            adminGroups[method.admin_id].push(method);
         });

         for (const [adminId, methods] of Object.entries(adminGroups)) {
            let methodsText = '';
            methods.forEach((method) => {
               methodsText += `**${method.name}**: ${method.details}${method.notes ? ` (${method.notes})` : ''}\n`;
            });

            embed.addFields({
               name: `👤 Admin Payment Methods`,
               value: methodsText,
               inline: false
            });
         }
      }

      // Add a note about contacting staff
      embed.addFields({
         name: '📞 Need Help?',
         value: 'If you have any questions about payment methods, please contact our staff.',
         inline: false
      });

      return embed;
   } catch (error) {
      console.error('Error getting payment methods embed:', error);
      return null;
   }
}

/**
 * Get payment methods for a specific admin
 * @param {Object} db - Database connection
 * @param {string} adminId - Admin ID
 * @returns {Promise<Array>} - Array of payment methods
 */
async function getPaymentMethodsForAdmin(db, adminId) {
   try {
      return await new Promise((resolve, reject) => {
         db.all('SELECT * FROM payment_methods WHERE admin_id = ? ORDER BY name ASC', [adminId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
         });
      });
   } catch (error) {
      console.error('Error getting payment methods for admin:', error);
      return [];
   }
}

/**
 * Get all payment methods from all admins
 * @param {Object} db - Database connection
 * @returns {Promise<Array>} - Array of all payment methods
 */
async function getAllPaymentMethods(db) {
   try {
      return await new Promise((resolve, reject) => {
         db.all('SELECT * FROM payment_methods ORDER BY admin_id, name ASC', (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
         });
      });
   } catch (error) {
      console.error('Error getting all payment methods:', error);
      return [];
   }
}

/**
 * Check if payment methods table exists and create if not
 * @param {Object} db - Database connection
 */
async function ensurePaymentMethodsTable(db) {
   return new Promise((resolve, reject) => {
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
}

module.exports = {
   getPaymentMethodsEmbed,
   getPaymentMethodsForAdmin,
   getAllPaymentMethods,
   ensurePaymentMethodsTable
}; 