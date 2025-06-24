const {
   SlashCommandBuilder,
   PermissionFlagsBits,
   EmbedBuilder,
   ButtonBuilder,
   ButtonStyle,
   ActionRowBuilder
} = require('discord.js');

module.exports = {
   data: new SlashCommandBuilder()
      .setName('helpdesk')
      .setDescription('Creates a help desk panel with ticket and order options')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addChannelOption(option =>
         option.setName('channel')
            .setDescription('Channel to send the panel (optional)')
            .setRequired(false)
      )
      .addStringOption(option =>
         option.setName('type')
            .setDescription('Type of panel to create')
            .setRequired(false)
            .addChoices(
               { name: 'Combined (Default)', value: 'combined' },
               { name: 'Support Tickets Only', value: 'tickets' },
               { name: 'Orders Only', value: 'orders' }
            )
      ),

   async execute(interaction) {
      // Check if a channel was specified in the command, otherwise use the current channel
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

      // Get the panel type (default to combined if not specified)
      const panelType = interaction.options.getString('type') || 'combined';

      // Get role names for display in the embed
      const adminRoleId = process.env.ADMIN_ROLE_ID;
      const userRoleId = process.env.USER_ROLE_ID;

      // Try to fetch role names from the IDs
      let adminRoleName = "Administrator";
      let userRoleName = "Authorized User";

      try {
         if (adminRoleId) {
            const adminRole = await interaction.guild.roles.fetch(adminRoleId);
            if (adminRole) adminRoleName = adminRole.name;
         }

         if (userRoleId) {
            const userRole = await interaction.guild.roles.fetch(userRoleId);
            if (userRole) userRoleName = userRole.name;
         }
      } catch (error) {
         console.error('Error fetching roles:', error);
      }

      // Create the appropriate panel based on type
      switch (panelType) {
         case 'tickets':
            await createTicketsPanel(interaction, targetChannel, adminRoleName, userRoleName);
            break;
         case 'orders':
            await createOrdersPanel(interaction, targetChannel, adminRoleName, userRoleName);
            break;
         case 'combined':
         default:
            await createCombinedPanel(interaction, targetChannel, adminRoleName, userRoleName);
            break;
      }
   }
};

/**
 * Creates a combined ticket and order panel
 */
async function createCombinedPanel(interaction, channel, adminRoleName, userRoleName) {
   // Create buttons for all options
   const combinedRow = new ActionRowBuilder()
      .addComponents(
         new ButtonBuilder()
            .setCustomId('open_ticket')
            .setLabel('Support Ticket')
            .setEmoji('🎫')
            .setStyle(ButtonStyle.Primary),
         new ButtonBuilder()
            .setCustomId('create_order')
            .setLabel('Place an Order')
            .setEmoji('🛒')
            .setStyle(ButtonStyle.Success),
         new ButtonBuilder()
            .setCustomId('roblox_dev_service')
            .setLabel('Roblox Game Dev Service')
            .setEmoji('🎮')
            .setStyle(ButtonStyle.Secondary)
      );

   const combinedEmbed = new EmbedBuilder()
      .setTitle('🏪 Gambler\'s Den Help Desk')
      .setDescription('How can we assist you today? Select one of the options below.')
      .addFields(
         {
            name: '🎫 Support Ticket',
            value: 'For general questions, issues, or assistance from staff. Select this option if you need help with something not related to shopping.'
         },
         {
            name: '🛒 Place an Order',
            value: 'Ready to make a purchase? Use this option to place an order for items from our shop inventory.'
         },
         {
            name: '🎮 Roblox Game Dev Service',
            value: 'Need help with Roblox game development? Create a ticket for specialized game development assistance.'
         },
         {
            name: '⚠️ Requirements',
            value: `You must have the **${userRoleName}** or **${adminRoleName}** role to create tickets and orders.`
         }
      )
      .setColor(0x9b59b6) // Purple color for neutral branding
      .setFooter({ text: "Gambler's Den Services" });

   await channel.send({
      embeds: [combinedEmbed],
      components: [combinedRow]
   });

   return await interaction.reply({
      content: `✅ Combined help desk panel has been created in ${channel}!`,
      flags: 64
   });
}

/**
 * Creates a tickets-only panel
 */
async function createTicketsPanel(interaction, channel, adminRoleName, userRoleName) {
   // Create buttons for tickets only
   const ticketRow = new ActionRowBuilder()
      .addComponents(
         new ButtonBuilder()
            .setCustomId('open_ticket')
            .setLabel('Open Support Ticket')
            .setEmoji('🎫')
            .setStyle(ButtonStyle.Primary)
      );

   const ticketEmbed = new EmbedBuilder()
      .setTitle('🎫 Support Ticket System')
      .setDescription('Need help from our staff? Create a support ticket!')
      .addFields(
         {
            name: '📋 How it works',
            value: 'When you click the button below, you\'ll be asked to provide details about your issue. Our staff will then assist you in a private channel.'
         },
         {
            name: '⚠️ Requirements',
            value: `You must have the **${userRoleName}** or **${adminRoleName}** role to create tickets.`
         }
      )
      .setColor(0x3498db) // Blue for tickets
      .setFooter({ text: "Gambler's Den Support" });

   await channel.send({
      embeds: [ticketEmbed],
      components: [ticketRow]
   });

   return await interaction.reply({
      content: `✅ Support ticket panel has been created in ${channel}!`,
      flags: 64
   });
}

/**
 * Creates an orders-only panel
 */
async function createOrdersPanel(interaction, channel, adminRoleName, userRoleName) {
   // Create buttons for orders only
   const orderRow = new ActionRowBuilder()
      .addComponents(
         new ButtonBuilder()
            .setCustomId('create_order')
            .setLabel('Place an Order')
            .setEmoji('🛒')
            .setStyle(ButtonStyle.Success)
      );

   const orderEmbed = new EmbedBuilder()
      .setTitle('🛒 Order System')
      .setDescription('Ready to make a purchase? Place your order here!')
      .addFields(
         {
            name: '📋 How it works',
            value: 'When you click the button below, you\'ll be asked to provide details about what you want to purchase. Our staff will then process your order in a private channel.'
         },
         {
            name: '⚠️ Requirements',
            value: `You must have the **${userRoleName}** or **${adminRoleName}** role to place orders.`
         }
      )
      .setColor(0x2ecc71) // Green for orders
      .setFooter({ text: "Gambler's Den Shop" });

   await channel.send({
      embeds: [orderEmbed],
      components: [orderRow]
   });

   return await interaction.reply({
      content: `✅ Order panel has been created in ${channel}!`,
      flags: 64
   });
}