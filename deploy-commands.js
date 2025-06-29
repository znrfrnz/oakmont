const { REST, Routes } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
   const commandExport = require(`./commands/${file}`);
   if (Array.isArray(commandExport)) {
      for (const command of commandExport) {
         if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
         }
      }
   } else if ('data' in commandExport && 'execute' in commandExport) {
      commands.push(commandExport.data.toJSON());
   }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
   try {
      console.log('🚀 Refreshing slash commands...');

      await rest.put(
         Routes.applicationGuildCommands(
            process.env.CLIENT_ID,
            process.env.GUILD_ID
         ),
         { body: commands }
      );

      console.log('✅ Slash commands registered successfully.');
   } catch (error) {
      console.error('❌ Failed to register commands:', error);
   }
})();
