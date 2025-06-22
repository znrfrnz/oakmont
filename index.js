const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
require('dotenv').config();
const updateStockEmbed = require('./utils/updateStockEmbed');
const updateQueueEmbed = require('./utils/updateQueueEmbed');

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

   client.user.setActivity(`Watching ${guildNames}`, { type: 'WATCHING' });
   console.log(`🎯 Set status: Watching ${guildNames} (${guildCount} server${guildCount !== 1 ? 's' : ''})`);

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
});

// Initialize command collection
client.commands = new Collection();

// Load all commands from /commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Initialize SQLite database and create tables if they don't exist
const db = new sqlite3.Database('./database.sqlite');

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
   const command = require(filePath);

   if ('data' in command && 'execute' in command) {
      // Add the db to the command object so it's accessible
      command.db = db;
      client.commands.set(command.data.name, command);
   } else {
      console.warn(`[⚠️] The command at ${filePath} is missing "data" or "execute".`);
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
