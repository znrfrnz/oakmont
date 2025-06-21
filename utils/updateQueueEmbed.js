const { EmbedBuilder } = require('discord.js');

/**
 * Updates the ticket queue display in the designated channel
 * @param {Client} client - The Discord client
 */
async function updateQueueEmbed(client) {
  try {
    // Get the queue channel ID from environment variables
    const queueChannelId = process.env.TICKET_QUEUE_CHANNEL;
    if (!queueChannelId) {
      console.log('No queue channel ID configured. Set TICKET_QUEUE_CHANNEL in .env');
      return;
    }
    
    // Fetch the queue channel
    const queueChannel = await client.channels.fetch(queueChannelId).catch(err => {
      console.error('Error fetching queue channel:', err);
      return null;
    });
    
    if (!queueChannel) {
      console.log('Queue channel not found. Check TICKET_QUEUE_CHANNEL in .env');
      return;
    }
    
    // Get guild for ticket channels
    const guild = queueChannel.guild;
    
    // Get the categories from environment variables
    const openCategoryId = process.env.TICKETS_OPEN_CATEGORY;
    const processingCategoryId = process.env.TICKETS_PROCESSING_CATEGORY;
    
    let openCategory = null;
    let processingCategory = null;
    
    // Fetch categories if configured
    if (openCategoryId) {
      try {
        openCategory = await guild.channels.fetch(openCategoryId);
      } catch (err) {
        console.error('Error fetching open tickets category:', err);
      }
    }
    
    if (processingCategoryId) {
      try {
        processingCategory = await guild.channels.fetch(processingCategoryId);
      } catch (err) {
        console.error('Error fetching processing tickets category:', err);
      }
    }
    
    // Create arrays to hold ticket channels
    let openTickets = [];
    let processingTickets = [];
    
    // If we have categories, get their channels
    if (openCategory) {
      openTickets = Array.from(guild.channels.cache.values())
        .filter(c => 
          c.parentId === openCategory.id && 
          (c.name.startsWith('support-') || c.name.startsWith('order-'))
        )
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    }
    
    if (processingCategory) {
      processingTickets = Array.from(guild.channels.cache.values())
        .filter(c => 
          c.parentId === processingCategory.id && 
          (c.name.startsWith('⚙️support-') || c.name.startsWith('⚙️order-') ||
           c.name.startsWith('support-') || c.name.startsWith('order-'))
        )
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    }
    
    // Create the queue embed
    const queueEmbed = new EmbedBuilder()
      .setTitle('🎫 Ticket Queue Status')
      .setDescription('Current status of all support tickets and orders')
      .setColor(0x9b59b6)
      .setTimestamp();
    
    // Add open tickets to the embed
    if (openTickets.length === 0) {
      queueEmbed.addFields({ name: '📝 Open Tickets', value: 'No tickets currently open' });
    } else {
      // Group tickets by type
      const openSupportTickets = openTickets.filter(t => t.name.startsWith('support-'));
      const openOrderTickets = openTickets.filter(t => t.name.startsWith('order-'));
      
      // Format support tickets
      if (openSupportTickets.length > 0) {
        let supportText = '';
        openSupportTickets.forEach((ticket, index) => {
          // Extract username from ticket name (support-username-subject)
          const parts = ticket.name.split('-');
          const username = parts.length > 1 ? parts[1] : 'unknown';
          
          supportText += `${index + 1}. ${ticket} (${username}) - Waiting since ${formatTimeSince(ticket.createdTimestamp)}\n`;
        });
        queueEmbed.addFields({ name: '📝 Open Support Tickets', value: supportText });
      }
      
      // Format order tickets
      if (openOrderTickets.length > 0) {
        let orderText = '';
        openOrderTickets.forEach((ticket, index) => {
          // Extract order number
          const orderNum = ticket.name.replace('order-', '');
          orderText += `${index + 1}. ${ticket} (Order #${orderNum}) - Waiting since ${formatTimeSince(ticket.createdTimestamp)}\n`;
        });
        queueEmbed.addFields({ name: '📝 Open Orders', value: orderText });
      }
    }
    
    // Add processing tickets to the embed
    if (processingTickets.length === 0) {
      queueEmbed.addFields({ name: '⚙️ Processing', value: 'No tickets currently being processed' });
    } else {
      // Group tickets by type
      const processingSupportTickets = processingTickets.filter(t => t.name.includes('support-'));
      const processingOrderTickets = processingTickets.filter(t => t.name.includes('order-'));
      
      // Format support tickets
      if (processingSupportTickets.length > 0) {
        let supportText = '';
        processingSupportTickets.forEach((ticket, index) => {
          // Strip the gear emoji if present
          const cleanName = ticket.name.replace('⚙️', '');
          // Extract username from ticket name
          const parts = cleanName.split('-');
          const username = parts.length > 1 ? parts[1] : 'unknown';
          
          supportText += `${index + 1}. ${ticket} (${username}) - In progress for ${formatTimeSince(ticket.createdTimestamp)}\n`;
        });
        queueEmbed.addFields({ name: '⚙️ Support Tickets Being Processed', value: supportText });
      }
      
      // Format order tickets
      if (processingOrderTickets.length > 0) {
        let orderText = '';
        processingOrderTickets.forEach((ticket, index) => {
          // Strip the gear emoji if present
          const cleanName = ticket.name.replace('⚙️', '');
          // Extract order number
          const orderNum = cleanName.replace('order-', '');
          orderText += `${index + 1}. ${ticket} (Order #${orderNum}) - In progress for ${formatTimeSince(ticket.createdTimestamp)}\n`;
        });
        queueEmbed.addFields({ name: '⚙️ Orders Being Processed', value: orderText });
      }
    }
    
    // Add estimated wait time based on queue length
    const totalWaiting = openTickets.length;
    let estimatedWait = 'No wait';
    
    if (totalWaiting > 0) {
      if (totalWaiting <= 2) {
        estimatedWait = 'Short wait (< 30 minutes)';
      } else if (totalWaiting <= 5) {
        estimatedWait = 'Medium wait (30-60 minutes)';
      } else {
        estimatedWait = 'Long wait (> 1 hour)';
      }
    }
    
    queueEmbed.addFields({ 
      name: '⏱️ Estimated Wait Time', 
      value: estimatedWait 
    });
    
    // Find existing queue message or send a new one
    const messages = await queueChannel.messages.fetch({ limit: 10 });
    const queueMessage = messages.find(m => 
      m.author.id === client.user.id && 
      m.embeds.length > 0 && 
      m.embeds[0].data.title === '🎫 Ticket Queue Status'
    );
    
    if (queueMessage) {
      await queueMessage.edit({ embeds: [queueEmbed] });
      console.log('Updated existing queue status embed');
    } else {
      await queueChannel.send({ embeds: [queueEmbed] });
      console.log('Sent new queue status embed');
    }
    
  } catch (error) {
    console.error('Error updating queue embed:', error);
  }
}

/**
 * Formats time since a timestamp in a human-readable format
 * @param {number} timestamp - The timestamp to format
 * @returns {string} - Formatted time string
 */
function formatTimeSince(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  // Convert to minutes
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 60) {
    return `${minutes}m ago`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m ago`;
  }
}

module.exports = updateQueueEmbed;