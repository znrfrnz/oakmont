const { Events } = require('discord.js');
const updateStockEmbed = require('../utils/updateStockEmbed');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    
    // Initialize shop DB connection
    const db = new sqlite3.Database(path.join(__dirname, '../db/shop.db'));
    
    // Ensure the stock table exists
    db.run(`CREATE TABLE IF NOT EXISTS stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0
    )`);
    
    // Initialize stock display
    try {
      await updateStockEmbed(client, db);
      console.log("Initial stock display updated");
    } catch (error) {
      console.error("Failed to update initial stock display:", error);
    }
  },
};