const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'giveaways.sqlite'));

db.serialize(() => {
   db.run(`CREATE TABLE IF NOT EXISTS giveaways (
    messageId TEXT PRIMARY KEY,
    channelId TEXT NOT NULL,
    guildId TEXT NOT NULL,
    prize TEXT NOT NULL,
    durationMs INTEGER NOT NULL,
    minRole TEXT,
    endTime INTEGER NOT NULL,
    numWinners INTEGER DEFAULT 1
  )`);
});

function saveGiveaway({ messageId, channelId, guildId, prize, durationMs, minRole, endTime, numWinners = 1 }) {
   return new Promise((resolve, reject) => {
      db.run(
         `INSERT OR REPLACE INTO giveaways (messageId, channelId, guildId, prize, durationMs, minRole, endTime, numWinners) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
         [messageId, channelId, guildId, prize, durationMs, minRole, endTime, numWinners],
         function (err) {
            if (err) reject(err);
            else resolve();
         }
      );
   });
}

function loadAllGiveaways() {
   return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM giveaways`, (err, rows) => {
         if (err) reject(err);
         else resolve(rows);
      });
   });
}

function deleteGiveaway(messageId) {
   return new Promise((resolve, reject) => {
      db.run(`DELETE FROM giveaways WHERE messageId = ?`, [messageId], function (err) {
         if (err) reject(err);
         else resolve();
      });
   });
}

module.exports = { saveGiveaway, loadAllGiveaways, deleteGiveaway }; 