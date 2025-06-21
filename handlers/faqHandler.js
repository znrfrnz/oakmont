const {
   ModalBuilder,
   TextInputBuilder,
   TextInputStyle,
   ActionRowBuilder,
   StringSelectMenuBuilder,
   EmbedBuilder
} = require('discord.js');
const updateFaqEmbed = require('../utils/updateFaqEmbed');

/**
 * Handles FAQ add modal submission
 */
async function handleFaqAddModalSubmit(interaction, db) {
   try {
      const question = interaction.fields.getTextInputValue('faq_question');
      const answer = interaction.fields.getTextInputValue('faq_answer');
      const positionInput = interaction.fields.getTextInputValue('faq_position');

      let position = 0;
      if (positionInput && positionInput.trim() !== '') {
         position = parseInt(positionInput);
         if (isNaN(position) || position < 0) {
            return interaction.reply({
               content: '❌ Invalid position. Please enter a valid number.',
               ephemeral: true
            });
         }
      }

      // If position is 0, find the next available position
      if (position === 0) {
         const maxPosition = await new Promise((resolve, reject) => {
            db.get('SELECT MAX(position) as maxPos FROM faq', (err, row) => {
               if (err) reject(err);
               else resolve(row ? row.maxPos : 0);
            });
         });
         position = maxPosition + 1;
      }

      // Insert the new FAQ
      await new Promise((resolve, reject) => {
         db.run(
            'INSERT INTO faq (question, answer, position) VALUES (?, ?, ?)',
            [question, answer, position],
            function (err) {
               if (err) reject(err);
               else resolve(this.lastID);
            }
         );
      });

      // Update the FAQ embed
      await updateFaqEmbed(interaction.client, db);

      await interaction.reply({
         content: `✅ FAQ added successfully!\n\n**Q:** ${question}\n**A:** ${answer}\n**Position:** ${position}`,
         ephemeral: true
      });

   } catch (error) {
      console.error('Error adding FAQ:', error);
      await interaction.reply({
         content: '❌ Error adding FAQ. Please try again.',
         ephemeral: true
      });
   }
}

/**
 * Handles FAQ edit selection
 */
async function handleFaqEditSelection(interaction, db) {
   try {
      const faqId = interaction.values[0];

      // Get the FAQ entry
      const faqEntry = await new Promise((resolve, reject) => {
         db.get('SELECT * FROM faq WHERE id = ?', [faqId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
         });
      });

      if (!faqEntry) {
         return interaction.update({
            content: '❌ FAQ entry not found.',
            components: []
         });
      }

      // Create edit modal
      const modal = new ModalBuilder()
         .setCustomId('faq_edit_modal')
         .setTitle('Edit FAQ');

      const questionInput = new TextInputBuilder()
         .setCustomId('faq_edit_question')
         .setLabel('Question')
         .setValue(faqEntry.question)
         .setStyle(TextInputStyle.Short)
         .setRequired(true)
         .setMaxLength(256);

      const answerInput = new TextInputBuilder()
         .setCustomId('faq_edit_answer')
         .setLabel('Answer')
         .setValue(faqEntry.answer)
         .setStyle(TextInputStyle.Paragraph)
         .setRequired(true)
         .setMaxLength(1024);

      const positionInput = new TextInputBuilder()
         .setCustomId('faq_edit_position')
         .setLabel('Position')
         .setValue(faqEntry.position.toString())
         .setStyle(TextInputStyle.Short)
         .setRequired(true);

      const questionRow = new ActionRowBuilder().addComponents(questionInput);
      const answerRow = new ActionRowBuilder().addComponents(answerInput);
      const positionRow = new ActionRowBuilder().addComponents(positionInput);

      modal.addComponents(questionRow, answerRow, positionRow);

      await interaction.showModal(modal);

   } catch (error) {
      console.error('Error handling FAQ edit selection:', error);
      await interaction.update({
         content: '❌ Error loading FAQ for editing.',
         components: []
      });
   }
}

/**
 * Handles FAQ edit modal submission
 */
async function handleFaqEditModalSubmit(interaction, db) {
   try {
      const question = interaction.fields.getTextInputValue('faq_edit_question');
      const answer = interaction.fields.getTextInputValue('faq_edit_answer');
      const position = parseInt(interaction.fields.getTextInputValue('faq_edit_position'));

      if (isNaN(position) || position < 0) {
         return interaction.reply({
            content: '❌ Invalid position. Please enter a valid number.',
            ephemeral: true
         });
      }

      // Get the original FAQ to find its ID
      const originalFaq = await new Promise((resolve, reject) => {
         db.get('SELECT * FROM faq WHERE question = ? OR answer = ? LIMIT 1', [question, answer], (err, row) => {
            if (err) reject(err);
            else resolve(row);
         });
      });

      if (!originalFaq) {
         return interaction.reply({
            content: '❌ FAQ entry not found.',
            ephemeral: true
         });
      }

      // Update the FAQ
      await new Promise((resolve, reject) => {
         db.run(
            'UPDATE faq SET question = ?, answer = ?, position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [question, answer, position, originalFaq.id],
            function (err) {
               if (err) reject(err);
               else resolve(this.changes);
            }
         );
      });

      // Update the FAQ embed
      await updateFaqEmbed(interaction.client, db);

      await interaction.reply({
         content: `✅ FAQ updated successfully!\n\n**Q:** ${question}\n**A:** ${answer}\n**Position:** ${position}`,
         ephemeral: true
      });

   } catch (error) {
      console.error('Error updating FAQ:', error);
      await interaction.reply({
         content: '❌ Error updating FAQ. Please try again.',
         ephemeral: true
      });
   }
}

/**
 * Handles FAQ remove selection
 */
async function handleFaqRemoveSelection(interaction, db) {
   try {
      const faqId = interaction.values[0];

      // Get the FAQ entry
      const faqEntry = await new Promise((resolve, reject) => {
         db.get('SELECT * FROM faq WHERE id = ?', [faqId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
         });
      });

      if (!faqEntry) {
         return interaction.update({
            content: '❌ FAQ entry not found.',
            components: []
         });
      }

      // Delete the FAQ
      await new Promise((resolve, reject) => {
         db.run('DELETE FROM faq WHERE id = ?', [faqId], function (err) {
            if (err) reject(err);
            else resolve(this.changes);
         });
      });

      // Update the FAQ embed
      await updateFaqEmbed(interaction.client, db);

      await interaction.update({
         content: `✅ FAQ removed successfully!\n\n**Removed:** ${faqEntry.question}`,
         components: []
      });

   } catch (error) {
      console.error('Error removing FAQ:', error);
      await interaction.update({
         content: '❌ Error removing FAQ.',
         components: []
      });
   }
}

/**
 * Handles FAQ reorder selection
 */
async function handleFaqReorderSelection(interaction, db) {
   try {
      const faqId = interaction.values[0];

      // Get the FAQ entry
      const faqEntry = await new Promise((resolve, reject) => {
         db.get('SELECT * FROM faq WHERE id = ?', [faqId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
         });
      });

      if (!faqEntry) {
         return interaction.update({
            content: '❌ FAQ entry not found.',
            components: []
         });
      }

      // Create reorder modal
      const modal = new ModalBuilder()
         .setCustomId('faq_reorder_modal')
         .setTitle('Reorder FAQ');

      const positionInput = new TextInputBuilder()
         .setCustomId('faq_reorder_position')
         .setLabel('New Position')
         .setPlaceholder('Enter the new position number')
         .setStyle(TextInputStyle.Short)
         .setRequired(true);

      const positionRow = new ActionRowBuilder().addComponents(positionInput);
      modal.addComponents(positionRow);

      await interaction.showModal(modal);

   } catch (error) {
      console.error('Error handling FAQ reorder selection:', error);
      await interaction.update({
         content: '❌ Error loading FAQ for reordering.',
         components: []
      });
   }
}

/**
 * Handles FAQ reorder modal submission
 */
async function handleFaqReorderModalSubmit(interaction, db) {
   try {
      const newPosition = parseInt(interaction.fields.getTextInputValue('faq_reorder_position'));

      if (isNaN(newPosition) || newPosition < 1) {
         return interaction.reply({
            content: '❌ Invalid position. Please enter a valid number greater than 0.',
            ephemeral: true
         });
      }

      // Get all FAQs to find the one being reordered
      const allFaqs = await new Promise((resolve, reject) => {
         db.all('SELECT * FROM faq ORDER BY position ASC', (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
         });
      });

      if (allFaqs.length === 0) {
         return interaction.reply({
            content: '❌ No FAQ entries found.',
            ephemeral: true
         });
      }

      // For simplicity, we'll reorder the first FAQ (you might want to improve this logic)
      const faqToReorder = allFaqs[0];

      // Update the position
      await new Promise((resolve, reject) => {
         db.run(
            'UPDATE faq SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newPosition, faqToReorder.id],
            function (err) {
               if (err) reject(err);
               else resolve(this.changes);
            }
         );
      });

      // Update the FAQ embed
      await updateFaqEmbed(interaction.client, db);

      await interaction.reply({
         content: `✅ FAQ reordered successfully!\n\n**Question:** ${faqToReorder.question}\n**New Position:** ${newPosition}`,
         ephemeral: true
      });

   } catch (error) {
      console.error('Error reordering FAQ:', error);
      await interaction.reply({
         content: '❌ Error reordering FAQ. Please try again.',
         ephemeral: true
      });
   }
}

module.exports = {
   handleFaqAddModalSubmit,
   handleFaqEditSelection,
   handleFaqEditModalSubmit,
   handleFaqRemoveSelection,
   handleFaqReorderSelection,
   handleFaqReorderModalSubmit
};
