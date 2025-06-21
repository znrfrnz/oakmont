const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-order-button')
    .setDescription('Sends the order button to #create-ticket')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('📩 Need to place an order?')
      .setDescription('Click the button below to open a ticket and begin your order.')
      .setColor(0x3498db);

    const button = new ButtonBuilder()
      .setCustomId('create_ticket')
      .setLabel('🎫 Create Ticket')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    const channel = interaction.guild.channels.cache.find(ch => ch.name === 'create-ticket');

    if (!channel) {
      return interaction.reply({
        content: '❌ Channel `#create-ticket` not found.',
        flags: 64
      });
    }

    await channel.send({ embeds: [embed], components: [row] });

    await interaction.reply({
      content: '✅ Ticket button sent to #create-ticket.',
      flags: 64
    });
  },
};
