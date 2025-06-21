const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbFolder = path.join(__dirname, '../db');
const dbPath = path.join(dbFolder, 'shop.db');

// Ensure db folder exists
if (!fs.existsSync(dbFolder)) {
   fs.mkdirSync(dbFolder);
}

// Ensure shop.db file exists
if (!fs.existsSync(dbPath)) {
   fs.writeFileSync(dbPath, '');
}

const db = new sqlite3.Database(dbPath);

// Ensure meta table exists
db.run(`
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

// Also ensure stock table exists
db.run(`
  CREATE TABLE IF NOT EXISTS stock (
    name TEXT PRIMARY KEY,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL
  )
`);

/**
 * Gets the appropriate Discord emoji ID based on the item name
 * @param {string} itemName - The name of the item
 * @returns {string} - The Discord emoji ID or fallback Unicode emoji
 */
function getPetEmoji(itemName) {
   const name = itemName.toLowerCase();

   // Dog breeds and dog-related
   if (name.includes('dog') || name.includes('puppy') || name.includes('canine') ||
      name.includes('husky') || name.includes('golden') || name.includes('retriever') ||
      name.includes('labrador') || name.includes('german') || name.includes('shepherd') ||
      name.includes('bulldog') || name.includes('poodle') || name.includes('chihuahua') ||
      name.includes('beagle') || name.includes('dachshund') || name.includes('rottweiler') ||
      name.includes('pitbull') || name.includes('boxer') || name.includes('collie')) {
      return '<:dog:1234567890123456789>'; // Replace with your server's dog emoji ID
   }

   // Cat breeds and cat-related
   if (name.includes('cat') || name.includes('kitten') || name.includes('feline') ||
      name.includes('persian') || name.includes('siamese') || name.includes('maine') ||
      name.includes('coon') || name.includes('british') || name.includes('shorthair') ||
      name.includes('ragdoll') || name.includes('bengal') || name.includes('sphynx') ||
      name.includes('abyssinian') || name.includes('russian') || name.includes('blue') ||
      name.includes('scottish') || name.includes('fold') || name.includes('munchkin')) {
      return '<:cat:1234567890123456790>'; // Replace with your server's cat emoji ID
   }

   // Birds
   if (name.includes('bird') || name.includes('parrot') || name.includes('cockatiel') ||
      name.includes('budgie') || name.includes('canary') || name.includes('finch') ||
      name.includes('macaw') || name.includes('cockatoo') || name.includes('lovebird') ||
      name.includes('conure') || name.includes('african') || name.includes('grey')) {
      return '<:bird:1234567890123456791>'; // Replace with your server's bird emoji ID
   }

   // Fish and aquatic pets
   if (name.includes('fish') || name.includes('goldfish') || name.includes('betta') ||
      name.includes('tetra') || name.includes('guppy') || name.includes('molly') ||
      name.includes('platy') || name.includes('swordtail') || name.includes('angelfish') ||
      name.includes('discus') || name.includes('cichlid') || name.includes('shark') ||
      name.includes('turtle') || name.includes('tortoise') || name.includes('frog') ||
      name.includes('toad') || name.includes('salamander') || name.includes('newt')) {
      return '<:fish:1234567890123456792>'; // Replace with your server's fish emoji ID
   }

   // Rodents and small mammals
   if (name.includes('hamster') || name.includes('mouse') || name.includes('rat') ||
      name.includes('gerbil') || name.includes('guinea') || name.includes('pig') ||
      name.includes('rabbit') || name.includes('bunny') || name.includes('chinchilla') ||
      name.includes('ferret') || name.includes('hedgehog') || name.includes('sugar') ||
      name.includes('glider') || name.includes('degu') || name.includes('chipmunk')) {
      return '<:hamster:1234567890123456793>'; // Replace with your server's hamster emoji ID
   }

   // Reptiles
   if (name.includes('snake') || name.includes('python') || name.includes('boa') ||
      name.includes('corn') || name.includes('ball') || name.includes('lizard') ||
      name.includes('gecko') || name.includes('bearded') || name.includes('dragon') ||
      name.includes('iguana') || name.includes('chameleon') || name.includes('skink') ||
      name.includes('monitor') || name.includes('anole') || name.includes('crested')) {
      return '<:lizard:1234567890123456794>'; // Replace with your server's lizard emoji ID
   }

   // Horses and farm animals
   if (name.includes('horse') || name.includes('pony') || name.includes('foal') ||
      name.includes('donkey') || name.includes('mule') || name.includes('goat') ||
      name.includes('sheep') || name.includes('pig') || name.includes('cow') ||
      name.includes('calf') || name.includes('chicken') || name.includes('duck') ||
      name.includes('goose') || name.includes('turkey') || name.includes('quail')) {
      return '<:horse:1234567890123456795>'; // Replace with your server's horse emoji ID
   }

   // Exotic pets
   if (name.includes('spider') || name.includes('tarantula') || name.includes('scorpion') ||
      name.includes('centipede') || name.includes('millipede') || name.includes('stick') ||
      name.includes('insect') || name.includes('beetle') || name.includes('mantis')) {
      return '<:spider:1234567890123456796>'; // Replace with your server's spider emoji ID
   }

   // Generic pet terms
   if (name.includes('pet') || name.includes('animal') || name.includes('creature') ||
      name.includes('companion') || name.includes('friend')) {
      return '<:paw:1234567890123456797>'; // Replace with your server's paw emoji ID
   }

   // Default emoji for unknown pets
   return '🐾';
}

/**
 * Updates the stock embed in the shop channel
 * @param {Client} client - The Discord client
 * @param {Database} db - SQLite database connection
 */
async function updateStockEmbed(client, db) {
   try {
      // Get the shop channel ID from environment variables
      const shopChannelId = process.env.SHOP_CHANNEL_ID;
      if (!shopChannelId) {
         console.log('No shop channel ID configured. Set SHOP_CHANNEL_ID in .env');
         return;
      }

      // Fetch the shop channel
      const shopChannel = await client.channels.fetch(shopChannelId).catch(err => {
         console.error('Error fetching shop channel:', err);
         return null;
      });

      if (!shopChannel) {
         console.log('Shop channel not found. Check SHOP_CHANNEL_ID in .env');
         return;
      }

      // Get all stock items
      const stockItems = await new Promise((resolve, reject) => {
         db.all('SELECT * FROM stock ORDER BY name ASC', (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
         });
      });

      // Create the embed
      const { EmbedBuilder } = require('discord.js');
      const stockEmbed = new EmbedBuilder()
         .setTitle('🏪 Gambler\'s Den')
         .setDescription('Welcome to our inventory! Here you can find all the items we have to offer.')
         .setColor(0x9b59b6) // Purple theme
         .setThumbnail(client.user.displayAvatarURL())
         .setTimestamp()
         .setFooter({
            text: '🛒 Use the "Place an Order" button in the help desk to adopt a pet',
            iconURL: client.user.displayAvatarURL()
         });

      // Check if we have any items
      if (stockItems.length === 0) {
         stockEmbed
            .setColor(0xe74c3c) // Red for empty
            .addFields({
               name: '🐾 Pet Inventory Status',
               value: '```md\n# No pets currently available\n\nWe\'re restocking! Check back soon.```',
               inline: false
            });
      } else {
         // Group items by availability
         const inStock = stockItems.filter(item => item.quantity > 0);
         const lowStock = stockItems.filter(item => item.quantity > 0 && item.quantity <= 5);
         const outOfStock = stockItems.filter(item => item.quantity <= 0);

         // Add in-stock items with better formatting and emphasis
         if (inStock.length > 0) {
            let inStockText = '';
            inStock.forEach((item, index) => {
               const priceFormatted = item.price.toLocaleString();
               const quantityFormatted = item.quantity.toLocaleString();
               inStockText += `**${item.name}**\n`;
               inStockText += `💰 **$${priceFormatted}** | 📦 **${quantityFormatted}** available\n\n`;
            });
            stockEmbed.addFields({
               name: '🟢 **AVAILABLE PETS**\n\n',
               value: inStockText.length > 1024 ? inStockText.substring(0, 1021) + '...' : inStockText,
               inline: false
            });
         }

         // Add low stock warning if any
         if (lowStock.length > 0) {
            let lowStockText = '';
            lowStock.forEach((item, index) => {
               lowStockText += `**${item.name}**\n`;
               lowStockText += `💰 **$${item.price.toLocaleString()}** | ⚠️ Only **${item.quantity}** left!\n\n`;
            });
            stockEmbed.addFields({
               name: '🟡 **LOW STOCK ALERT**',
               value: lowStockText,
               inline: false
            });
         }

         // Add out-of-stock items
         if (outOfStock.length > 0) {
            let outOfStockText = '';
            outOfStock.forEach((item, index) => {
               outOfStockText += `**${item.name}**\n`;
               outOfStockText += `❌ **Out of stock**\n\n`;
            });
            stockEmbed.addFields({
               name: '❌ **OUT OF STOCK**',
               value: outOfStockText.length > 1024 ? outOfStockText.substring(0, 1021) + '...' : outOfStockText,
               inline: false
            });
         }

         // Add ordering instructions with better formatting
         stockEmbed.addFields({
            name: '\n🛒 How to Order',
            value: '```md\n# Step 1: Go to the help desk channel\n# Step 2: Click "Place an Order"\n# Step 3: Fill out the order form\n# Step 4: Wait for staff to process your order\n\n*All orders are processed manually by our staff*```',
            inline: false
         });

         // Add additional info
         stockEmbed.addFields({
            name: 'ℹ️ Additional Information',
            value: '• Prices are subject to change\n• Stock levels are updated in real-time\n• Contact staff for bulk orders\n• All sales are final',
            inline: false
         });
      }

      // Find existing stock message or send a new one
      const messages = await shopChannel.messages.fetch({ limit: 10 });
      const stockMessage = messages.find(m =>
         m.author.id === client.user.id &&
         m.embeds.length > 0 &&
         m.embeds[0].data.title === '🏪 Gambler\'s Den'
      );

      if (stockMessage) {
         await stockMessage.edit({ embeds: [stockEmbed] });
         console.log('Updated existing stock embed');
      } else {
         await shopChannel.send({ embeds: [stockEmbed] });
         console.log('Sent new stock embed');
      }

   } catch (error) {
      console.error('Error updating stock embed:', error);
   }
}

module.exports = updateStockEmbed;
module.exports.getPetEmoji = getPetEmoji;
