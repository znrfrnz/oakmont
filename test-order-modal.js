const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

// Test the order modal structure
function testOrderModal() {
   console.log('🧪 Testing Order Modal Structure...\n');

   try {
      // Create the modal (same structure as in interactionCreate.js)
      const modal = new ModalBuilder()
         .setCustomId('order_create_modal')
         .setTitle('Place an Order');

      // Create the combined input field
      const itemsInput = new TextInputBuilder()
         .setCustomId('orderItems')
         .setLabel('Items, Pets, and Sheckles')
         .setPlaceholder('e.g. 2 Dog Food, 1 Cat Toy, 2 dogs, 1000 sheckles')
         .setStyle(TextInputStyle.Paragraph)
         .setRequired(true);

      const requestsInput = new TextInputBuilder()
         .setCustomId('orderRequests')
         .setLabel('Special Requests (Optional)')
         .setPlaceholder('Any special instructions for your order')
         .setStyle(TextInputStyle.Paragraph)
         .setMaxLength(1000)
         .setRequired(false);

      // Add inputs to rows
      const itemsRow = new ActionRowBuilder().addComponents(itemsInput);
      const requestsRow = new ActionRowBuilder().addComponents(requestsInput);

      // Add the rows to the modal
      modal.addComponents(itemsRow, requestsRow);

      console.log('✅ Order modal created successfully');
      console.log(`📋 Modal ID: ${modal.data.custom_id}`);
      console.log(`📝 Modal Title: ${modal.data.title}`);

      // Check if components exist
      if (modal.data.components && modal.data.components.length > 0) {
         console.log(`🔢 Number of components: ${modal.data.components.length}`);

         console.log('\n📋 Modal Fields:');
         modal.data.components.forEach((row, index) => {
            if (row.components && row.components.length > 0) {
               const input = row.components[0];
               console.log(`  ${index + 1}. ${input.label} (${input.custom_id})`);
               console.log(`     Required: ${input.required}`);
               console.log(`     Max Length: ${input.max_length || 'No limit'}`);
               console.log(`     Style: ${input.style === 1 ? 'Short' : 'Paragraph'}`);
            }
         });
      } else {
         console.log('⚠️ No components found in modal');
      }

      console.log('\n🎉 Order modal test completed successfully!');

   } catch (error) {
      console.error('❌ Error testing order modal:', error.message);
   }
}

// Test the combined input parsing logic
function testCombinedInputParsing() {
   console.log('\n🧪 Testing Combined Input Parsing...\n');

   // Test cases with different combinations
   const testCases = [
      {
         name: 'Mixed Order',
         input: '2 Dog Food\n1 Cat Toy\n2 golden retrievers\n1000 regular sheckles\n500 silver sheckles'
      },
      {
         name: 'Items Only',
         input: '3 Dog Food\n1 Cat Toy\n2 Hamster Food'
      },
      {
         name: 'Pets Only',
         input: '1 cat\n2 dogs\n3 hamsters'
      },
      {
         name: 'Sheckles Only',
         input: '1000 sheckles\n500 silver sheckles'
      },
      {
         name: 'Mixed with Special Format',
         input: 'Dog Food\n2 cats\n1000 sheckles\n1 Bird Food'
      }
   ];

   testCases.forEach(testCase => {
      console.log(`📝 Testing: ${testCase.name}`);
      console.log(`Input:\n${testCase.input}`);

      // Parse the combined input (same logic as in orderHandler.js)
      const lines = testCase.input.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      const items = [];
      const pets = [];
      const sheckles = [];

      for (const line of lines) {
         // Check if it's a sheckle entry (contains "sheckle")
         if (line.toLowerCase().includes('sheckle')) {
            sheckles.push(line);
            continue;
         }

         // Check if it matches the item pattern (number + item name) FIRST
         const itemMatch = line.match(/^([0-9]+)\s+(.+)$/);
         if (itemMatch) {
            items.push({
               name: itemMatch[2].trim(),
               quantity: parseInt(itemMatch[1], 10)
            });
            continue;
         }

         // Check if it's a pet entry (common pet keywords) - only if no item pattern matched
         const petKeywords = ['dog', 'cat', 'hamster', 'bird', 'fish', 'rabbit', 'guinea pig', 'ferret', 'snake', 'lizard', 'turtle', 'horse', 'cow', 'pig', 'chicken', 'duck', 'goose', 'sheep', 'goat'];
         const isPet = petKeywords.some(keyword => line.toLowerCase().includes(keyword));

         if (isPet) {
            pets.push(line);
            continue;
         }

         // If it doesn't match any pattern, treat as an item with quantity 1
         items.push({
            name: line,
            quantity: 1
         });
      }

      console.log('✅ Parsed Results:');
      if (items.length > 0) {
         console.log(`  🛒 Items: ${items.map(item => `${item.quantity}x ${item.name}`).join(', ')}`);
      }
      if (pets.length > 0) {
         console.log(`  🐾 Pets: ${pets.join(', ')}`);
      }
      if (sheckles.length > 0) {
         console.log(`  💰 Sheckles: ${sheckles.join(', ')}`);
      }
      console.log('');
   });

   console.log('🎉 Combined input parsing test completed successfully!');
}

// Run the tests
testOrderModal();
testCombinedInputParsing(); 