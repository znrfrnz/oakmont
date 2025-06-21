const { 
  SlashCommandBuilder, 
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder
} = require('discord.js');

const updateFaqEmbed = require('../utils/updateFaqEmbed');
const createFaqTable = require('../utils/createFaqTable');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('faq')
    .setDescription('Manage the FAQ')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a new FAQ entry')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Edit an existing FAQ entry')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove an FAQ entry')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all FAQ entries')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reorder')
        .setDescription('Change the order of FAQ entries')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('update')
        .setDescription('Force update the FAQ embed')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const db = interaction.client.db;
    
    // Ensure FAQ table exists before proceeding
    try {
      await createFaqTable(db);
    } catch (error) {
      return interaction.reply({
        content: '❌ Error initializing FAQ database: ' + error.message,
        ephemeral: true
      });
    }
    
    // Handle each subcommand
    switch (subcommand) {
      case 'add':
        await handleAddFaq(interaction);
        break;
      case 'edit':
        await handleEditFaq(interaction, db);
        break;
      case 'remove':
        await handleRemoveFaq(interaction, db);
        break;
      case 'list':
        await handleListFaq(interaction, db);
        break;
      case 'reorder':
        await handleReorderFaq(interaction, db);
        break;
      case 'update':
        await handleUpdateFaq(interaction, db);
        break;
    }
  }
};

/**
 * Handles adding a new FAQ
 */
async function handleAddFaq(interaction) {
  // Create a modal for adding a new FAQ
  const modal = new ModalBuilder()
    .setCustomId('faq_add_modal')
    .setTitle('Add New FAQ');

  // Create text inputs for the modal
  const questionInput = new TextInputBuilder()
    .setCustomId('faq_question')
    .setLabel('Question')
    .setPlaceholder('What is your question?')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(256);

  const answerInput = new TextInputBuilder()
    .setCustomId('faq_answer')
    .setLabel('Answer')
    .setPlaceholder('Provide an answer to the question')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1024);

  const positionInput = new TextInputBuilder()
    .setCustomId('faq_position')
    .setLabel('Position (order number)')
    .setPlaceholder('Enter a position number (leave empty for the end)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  // Add inputs to rows
  const questionRow = new ActionRowBuilder().addComponents(questionInput);
  const answerRow = new ActionRowBuilder().addComponents(answerInput);
  const positionRow = new ActionRowBuilder().addComponents(positionInput);

  // Add the rows to the modal
  modal.addComponents(questionRow, answerRow, positionRow);

  // Show the modal to the user
  await interaction.showModal(modal);
}

/**
 * Handles editing an FAQ
 */
async function handleEditFaq(interaction, db) {
  // Get all FAQ entries for selection
  const faqEntries = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM faq ORDER BY position ASC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  if (faqEntries.length === 0) {
    return interaction.reply({
      content: '❌ There are no FAQ entries to edit.',
      ephemeral: true
    });
  }
  
  // Create a select menu with the FAQs
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('faq_edit_select')
    .setPlaceholder('Select an FAQ to edit')
    .addOptions(faqEntries.map(faq => ({
      label: faq.question.substring(0, 100), // Truncate if too long
      description: `ID: ${faq.id} | Position: ${faq.position}`,
      value: faq.id.toString()
    })));

  const row = new ActionRowBuilder().addComponents(selectMenu);
  
  await interaction.reply({
    content: 'Please select an FAQ entry to edit:',
    components: [row],
    ephemeral: true
  });
}

/**
 * Handles removing an FAQ
 */
async function handleRemoveFaq(interaction, db) {
  // Get all FAQ entries for selection
  const faqEntries = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM faq ORDER BY position ASC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  if (faqEntries.length === 0) {
    return interaction.reply({
      content: '❌ There are no FAQ entries to remove.',
      ephemeral: true
    });
  }
  
  // Create a select menu with the FAQs
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('faq_remove_select')
    .setPlaceholder('Select an FAQ to remove')
    .addOptions(faqEntries.map(faq => ({
      label: faq.question.substring(0, 100), // Truncate if too long
      description: `ID: ${faq.id} | Position: ${faq.position}`,
      value: faq.id.toString()
    })));

  const row = new ActionRowBuilder().addComponents(selectMenu);
  
  await interaction.reply({
    content: '⚠️ Please select an FAQ entry to remove:',
    components: [row],
    ephemeral: true
  });
}

/**
 * Lists all FAQ entries
 */
async function handleListFaq(interaction, db) {
  // Get all FAQ entries
  const faqEntries = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM faq ORDER BY position ASC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  if (faqEntries.length === 0) {
    return interaction.reply({
      content: 'ℹ️ There are no FAQ entries.',
      ephemeral: true
    });
  }
  
  // Create an embed to display the FAQs
  const embed = new EmbedBuilder()
    .setTitle('📋 FAQ List')
    .setDescription(`Found ${faqEntries.length} FAQ entries.`)
    .setColor(0x3498db)
    .setTimestamp();
  
  // Add each FAQ as a field
  faqEntries.forEach((faq, index) => {
    embed.addFields({
      name: `${index + 1}. ${faq.question.substring(0, 100)}`,
      value: `ID: ${faq.id} | Position: ${faq.position} | Last updated: ${new Date(faq.updated_at).toLocaleString()}`
    });
  });
  
  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

/**
 * Handles reordering FAQs
 */
async function handleReorderFaq(interaction, db) {
  // Get all FAQ entries
  const faqEntries = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM faq ORDER BY position ASC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  if (faqEntries.length < 2) {
    return interaction.reply({
      content: '❌ You need at least 2 FAQ entries to reorder them.',
      ephemeral: true
    });
  }
  
  // Create a select menu with the FAQs
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('faq_reorder_select')
    .setPlaceholder('Select an FAQ to move')
    .addOptions(faqEntries.map(faq => ({
      label: faq.question.substring(0, 100), // Truncate if too long
      description: `Current Position: ${faq.position}`,
      value: faq.id.toString()
    })));

  const row = new ActionRowBuilder().addComponents(selectMenu);
  
  await interaction.reply({
    content: 'Please select an FAQ entry to reposition:',
    components: [row],
    ephemeral: true
  });
}

/**
 * Forces an update of the FAQ embed
 */
async function handleUpdateFaq(interaction, db) {
  await interaction.deferReply({ ephemeral: true });
  
  const result = await updateFaqEmbed(interaction.client, db);
  
  if (result.success) {
    await interaction.editReply({
      content: '✅ FAQ embed has been updated!',
      ephemeral: true
    });
  } else {
    await interaction.editReply({
      content: `❌ Failed to update FAQ embed: ${result.error}`,
      ephemeral: true
    });
  }
}
