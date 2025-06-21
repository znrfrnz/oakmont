const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const createFaqTable = require('./utils/createFaqTable');

// Test the FAQ system components
async function testFaqSystem() {
   console.log('🧪 Testing FAQ System Components...\n');

   // Create a test database
   const testDb = new sqlite3.Database(':memory:');

   try {
      // Test 1: Create FAQ table
      console.log('1. Testing FAQ table creation...');
      await createFaqTable(testDb);
      console.log('✅ FAQ table created successfully\n');

      // Test 2: Insert test FAQ
      console.log('2. Testing FAQ insertion...');
      await new Promise((resolve, reject) => {
         testDb.run(
            'INSERT INTO faq (question, answer, position) VALUES (?, ?, ?)',
            ['What is this bot?', 'This is a Discord bot for managing a pet shop.', 1],
            function (err) {
               if (err) reject(err);
               else resolve(this.lastID);
            }
         );
      });
      console.log('✅ Test FAQ inserted successfully\n');

      // Test 3: Query FAQ
      console.log('3. Testing FAQ query...');
      const faqs = await new Promise((resolve, reject) => {
         testDb.all('SELECT * FROM faq ORDER BY position ASC', (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
         });
      });
      console.log(`✅ Found ${faqs.length} FAQ entries:`);
      faqs.forEach(faq => {
         console.log(`   - ID: ${faq.id}, Q: ${faq.question}, Position: ${faq.position}`);
      });
      console.log('');

      // Test 4: Update FAQ
      console.log('4. Testing FAQ update...');
      await new Promise((resolve, reject) => {
         testDb.run(
            'UPDATE faq SET answer = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['This is an updated answer for the Discord bot.', faqs[0].id],
            function (err) {
               if (err) reject(err);
               else resolve(this.changes);
            }
         );
      });
      console.log('✅ FAQ updated successfully\n');

      // Test 5: Delete FAQ
      console.log('5. Testing FAQ deletion...');
      await new Promise((resolve, reject) => {
         testDb.run('DELETE FROM faq WHERE id = ?', [faqs[0].id], function (err) {
            if (err) reject(err);
            else resolve(this.changes);
         });
      });
      console.log('✅ FAQ deleted successfully\n');

      console.log('🎉 All FAQ system tests passed!');

   } catch (error) {
      console.error('❌ Test failed:', error.message);
   } finally {
      testDb.close();
   }
}

// Run the test
testFaqSystem(); 