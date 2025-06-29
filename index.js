const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Client, Collection, GatewayIntentBits, Partials, ActivityType } = require('discord.js');
require('dotenv').config();
const updateStockEmbed = require('./utils/updateStockEmbed');
const updateQueueEmbed = require('./utils/updateQueueEmbed');
const { loadAllGiveaways, deleteGiveaway } = require('./db/giveaways.db');
const { parseDuration } = require('./utils/createGiveawayUtils');

// Create a new Discord client
const client = new Client({
   intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
   ],
   partials: [
      Partials.User,
      Partials.Channel,
      Partials.Message,
      Partials.Reaction,
      Partials.GuildMember,
   ],
});

// Log when ready
client.once('ready', async () => {
   console.log(`✅ Logged in as ${client.user.tag}`);

   // Set bot status to show which server it's in
   const guildCount = client.guilds.cache.size;
   const guildNames = client.guilds.cache.map(guild => guild.name).join(', ');

   try {
      client.user.setActivity(guildNames, { type: ActivityType.Watching });
      console.log(`🎯 Set status: Watching ${guildNames} (${guildCount} server${guildCount !== 1 ? 's' : ''})`);
   } catch (error) {
      console.error('❌ Error setting bot status:', error);
   }

   // Verify role IDs exist and log them
   const adminRoleId = process.env.ADMIN_ROLE_ID;
   const userRoleId = process.env.USER_ROLE_ID;

   if (adminRoleId) {
      try {
         // Try to fetch the role from any guild the bot is in
         let foundRole = false;
         for (const guild of client.guilds.cache.values()) {
            try {
               const role = await guild.roles.fetch(adminRoleId);
               if (role) {
                  console.log(`✅ Admin role found: ${role.name} (${role.id})`);
                  foundRole = true;
                  break;
               }
            } catch { }
         }
         if (!foundRole) console.log(`⚠️ Admin role with ID ${adminRoleId} not found in any guild`);
      } catch (error) {
         console.error('Error verifying admin role ID:', error);
      }
   } else {
      console.log('⚠️ No admin role ID configured in .env');
   }

   if (userRoleId) {
      try {
         // Try to fetch the role from any guild the bot is in
         let foundRole = false;
         for (const guild of client.guilds.cache.values()) {
            try {
               const role = await guild.roles.fetch(userRoleId);
               if (role) {
                  console.log(`✅ User role found: ${role.name} (${role.id})`);
                  foundRole = true;
                  break;
               }
            } catch { }
         }
         if (!foundRole) console.log(`⚠️ User role with ID ${userRoleId} not found in any guild`);
      } catch (error) {
         console.error('Error verifying user role ID:', error);
      }
   } else {
      console.log('⚠️ No user role ID configured in .env');
   }

   // Initialize the queue display
   updateQueueEmbed(client);

   // Set up automatic queue updates
   setInterval(() => {
      updateQueueEmbed(client);
   }, 5 * 60 * 1000); // 5 minutes

   // Update the FAQ embed
   const updateFaqEmbed = require('./utils/updateFaqEmbed');
   await updateFaqEmbed(client, db).catch(console.error);

   // Restore ongoing giveaways
   const giveaways = await loadAllGiveaways();
   for (const g of giveaways) {
      const guild = client.guilds.cache.get(g.guildId);
      if (!guild) continue;
      const channel = guild.channels.cache.get(g.channelId);
      if (!channel || !channel.isTextBased()) continue;
      const timeLeft = g.endTime - Date.now();
      if (timeLeft <= 0) {
         // End immediately if overdue
         setTimeout(async () => {
            try {
               const msg = await channel.messages.fetch(g.messageId);
               const reaction = msg.reactions.cache.get('🎉');
               if (!reaction) {
                  await channel.send('No one entered the giveaway. 😢');
                  await deleteGiveaway(g.messageId);
                  return;
               }
               let users = await reaction.users.fetch();
               users = users.filter(u => !u.bot);
               let eligibleUsers = users;
               if (g.minRole) {
                  let role = guild.roles.cache.find(r => r.id === g.minRole || r.name.toLowerCase() === g.minRole.toLowerCase());
                  if (role) {
                     eligibleUsers = users.filter(u => {
                        const member = guild.members.cache.get(u.id);
                        return member && member.roles.cache.has(role.id);
                     });
                  }
               }
               if (!eligibleUsers.size) {
                  await channel.send('No eligible users entered the giveaway. 😢');
                  await deleteGiveaway(g.messageId);
                  return;
               }
               const winner = eligibleUsers.random();
               await channel.send(`🎉 Congratulations ${winner}! You won **${g.prize}**!`);
               await deleteGiveaway(g.messageId);
            } catch (err) {
               await channel.send('❌ Error ending the giveaway.');
               await deleteGiveaway(g.messageId);
            }
         }, 5000);
      } else {
         setTimeout(async () => {
            try {
               const msg = await channel.messages.fetch(g.messageId);
               const reaction = msg.reactions.cache.get('🎉');
               if (!reaction) {
                  await channel.send('No one entered the giveaway. 😢');
                  await deleteGiveaway(g.messageId);
                  return;
               }
               let users = await reaction.users.fetch();
               users = users.filter(u => !u.bot);
               let eligibleUsers = users;
               if (g.minRole) {
                  let role = guild.roles.cache.find(r => r.id === g.minRole || r.name.toLowerCase() === g.minRole.toLowerCase());
                  if (role) {
                     eligibleUsers = users.filter(u => {
                        const member = guild.members.cache.get(u.id);
                        return member && member.roles.cache.has(role.id);
                     });
                  }
               }
               if (!eligibleUsers.size) {
                  await channel.send('No eligible users entered the giveaway. 😢');
                  await deleteGiveaway(g.messageId);
                  return;
               }
               const winner = eligibleUsers.random();
               await channel.send(`🎉 Congratulations ${winner}! You won **${g.prize}**!`);
               await deleteGiveaway(g.messageId);
            } catch (err) {
               await channel.send('❌ Error ending the giveaway.');
               await deleteGiveaway(g.messageId);
            }
         }, timeLeft);
      }
   }
});

// Initialize command collection
client.commands = new Collection();

// Load all commands from /commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Initialize SQLite database and create tables if they don't exist
const db = new sqlite3.Database('./db/shop.db');

// Create stock table if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS stock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  price REAL,
  quantity INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

// Create FAQ table if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS faq (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
   if (err) {
      console.error('Error creating FAQ table:', err);
   } else {
      console.log('FAQ table created or already exists');
   }
});

// Make the database available to all parts of the bot
client.db = db;

// Modify the command registration loop to pass db
for (const file of commandFiles) {
   const filePath = path.join(commandsPath, file);

   try {
      const commandExport = require(filePath);

      if (Array.isArray(commandExport)) {
         for (const command of commandExport) {
            if ('data' in command && 'execute' in command) {
               command.db = db;
               client.commands.set(command.data.name, command);
            } else {
               console.warn(`[⚠️] The command in array at ${filePath} is missing "data" or "execute".`);
            }
         }
      } else if (typeof commandExport === 'object') {
         // First, check if the main export has data and execute (like stock.js, helpdesk.js)
         if ('data' in commandExport && 'execute' in commandExport) {
            commandExport.db = db;
            client.commands.set(commandExport.data.name, commandExport);
         }

         // Then check for additional commands as properties (like giveaway.js with reroll)
         for (const key of Object.keys(commandExport)) {
            const command = commandExport[key];
            if (command && typeof command === 'object' && 'data' in command && 'execute' in command) {
               command.db = db;
               client.commands.set(command.data.name, command);
            }
         }
      } else {
         console.warn(`[⚠️] The command at ${filePath} is missing "data" or "execute".`);
      }
   } catch (error) {
      console.error(`❌ Error loading command from ${file}:`, error);
   }
}

// Load all events from /events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
   const filePath = path.join(eventsPath, file);
   const event = require(filePath);

   if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
   } else {
      client.on(event.name, (...args) => event.execute(...args));
   }
}

// Log in the bot
client.login(process.env.DISCORD_TOKEN);
