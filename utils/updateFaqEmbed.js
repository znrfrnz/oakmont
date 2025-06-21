const { EmbedBuilder } = require('discord.js');
const createFaqTable = require('./createFaqTable');

/**
 * Updates the FAQ embed in the designated channel
 * @param {Client} client - The Discord client
 * @param {Database} db - Database connection
 */
async function updateFaqEmbed(client, db) {
   try {
      // Ensure FAQ table exists
      await createFaqTable(db);

      // Get the FAQ channel ID from environment variables
      const faqChannelId = process.env.FAQ_CHANNEL_ID;
      if (!faqChannelId) {
         console.log('No FAQ channel ID configured. Set FAQ_CHANNEL_ID in .env');
         return { success: false, error: 'FAQ_CHANNEL_ID not configured' };
      }

      // Fetch the FAQ channel
      const faqChannel = await client.channels.fetch(faqChannelId).catch(err => {
         console.error('Error fetching FAQ channel:', err);
         return null;
      });

      if (!faqChannel) {
         console.log('FAQ channel not found. Check FAQ_CHANNEL_ID in .env');
         return { success: false, error: 'FAQ channel not found' };
      }

      // Get all FAQ entries
      const faqEntries = await new Promise((resolve, reject) => {
         db.all('SELECT * FROM faq ORDER BY position ASC', (err, rows) => {
            if (err) {
               console.error('Error fetching FAQ entries:', err);
               reject(err);
            } else {
               resolve(rows || []);
            }
         });
      });

      // Create the FAQ embed
      const faqEmbed = new EmbedBuilder()
         .setTitle('❓ Frequently Asked Questions')
         .setDescription('Here are answers to our most common questions.')
         .setColor(0x3498db) // Blue color
         .setTimestamp()
         .setFooter({ text: 'Last updated' });

      // Check if we have any FAQ entries
      if (faqEntries.length === 0) {
         faqEmbed.addFields({ name: 'No FAQs available', value: 'FAQs will appear here once they are added.' });
      } else {
         // Add each FAQ entry to the embed
         faqEntries.forEach((entry, index) => {
            faqEmbed.addFields({
               name: `${index + 1}. ${entry.question}`,
               value: entry.answer
            });
         });
      }

      // Find existing FAQ message or send a new one
      const messages = await faqChannel.messages.fetch({ limit: 10 });
      const faqMessage = messages.find(m =>
         m.author.id === client.user.id &&
         m.embeds.length > 0 &&
         m.embeds[0].data.title === '❓ Frequently Asked Questions'
      );

      if (faqMessage) {
         await faqMessage.edit({ embeds: [faqEmbed] });
         console.log('Updated existing FAQ embed');
      } else {
         await faqChannel.send({ embeds: [faqEmbed] });
         console.log('Sent new FAQ embed');
      }

      return { success: true };
   } catch (error) {
      console.error('Error updating FAQ embed:', error);
      return { success: false, error: error.message };
   }
}

module.exports = updateFaqEmbed;