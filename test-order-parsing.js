// Test the new order parsing logic
function testOrderParsing() {
   console.log('🧪 Testing Order Parsing Logic...\n');

   const testInput = "need 1queen bee, 1 df, and 2 praying mantis if u got";
   console.log('Test input:', testInput);

   // Simulate the parsing logic
   const lines = testInput.split('\n').map(line => line.trim()).filter(line => line.length > 0);
   console.log('Lines:', lines);

   const items = [];
   const pets = [];
   const sheckles = [];

   // Mock stock items for testing
   const allItems = [
      { name: 'Disco Bee', price: 4.6, quantity: 10 },
      { name: 'Queen Bee', price: 10.0, quantity: 5 },
      { name: 'Praying Mantis', price: 8.0, quantity: 3 }
   ];
   const stockNames = allItems.map(i => i.name.toLowerCase());

   console.log('Available stock items:', stockNames);

   // Process each line
   for (const line of lines) {
      console.log('\nProcessing line:', line);
      // Split by commas and process each part
      const parts = line.split(',').map(part => part.trim()).filter(part => part.length > 0);
      console.log('Split parts:', parts);

      for (const part of parts) {
         console.log('\nProcessing part:', part);
         // Remove common filler words and clean up the text
         let cleanedPart = part.toLowerCase()
            .replace(/\b(need|want|get|please|if you have|if u got|if available)\b/g, '')
            .replace(/\band\b/g, '')
            .trim();

         console.log('Cleaned part:', cleanedPart);

         // Skip empty parts
         if (!cleanedPart) continue;

         // Sheckles detection
         if (cleanedPart.includes('sheckle')) {
            sheckles.push(part.trim());
            console.log('Added to sheckles:', part.trim());
            continue;
         }

         // Try to match as item with various patterns
         // Pattern 1: "1 queen bee" or "1queen bee"
         let itemMatch = cleanedPart.match(/^(\d+)\s*([a-zA-Z\s]+)$/);

         // Pattern 2: "queen bee" (assume quantity 1)
         if (!itemMatch) {
            itemMatch = cleanedPart.match(/^([a-zA-Z\s]+)$/);
            if (itemMatch) {
               itemMatch = [null, '1', itemMatch[1]];
            }
         }

         console.log('Item match result:', itemMatch);

         if (itemMatch) {
            const itemName = itemMatch[2].trim();
            const quantity = parseInt(itemMatch[1], 10);
            console.log('Attempting to match item:', itemName, 'quantity:', quantity);

            // First try exact match (case-insensitive)
            let stockIndex = stockNames.indexOf(itemName.toLowerCase());

            // If no exact match, try fuzzy matching (simplified for test)
            if (stockIndex === -1) {
               // Simple fuzzy matching for test
               for (let i = 0; i < allItems.length; i++) {
                  if (allItems[i].name.toLowerCase().includes(itemName.toLowerCase()) ||
                     itemName.toLowerCase().includes(allItems[i].name.toLowerCase())) {
                     stockIndex = i;
                     console.log(`Fuzzy matched "${itemName}" to "${allItems[i].name}"`);
                     break;
                  }
               }
            }

            if (stockIndex !== -1) {
               items.push({
                  name: allItems[stockIndex].name,
                  quantity: quantity,
                  price: allItems[stockIndex].price
               });
               console.log('Added item:', allItems[stockIndex].name);
               continue;
            }
         }

         // If not matched as stock item, treat as pet
         pets.push(part.trim());
         console.log('Added to pets:', part.trim());
      }
   }

   console.log('\n=== FINAL RESULTS ===');
   console.log('Items:', items);
   console.log('Pets:', pets);
   console.log('Sheckles:', sheckles);
   console.log('\n✅ Order parsing test completed!');
}

// Run the test
testOrderParsing(); 