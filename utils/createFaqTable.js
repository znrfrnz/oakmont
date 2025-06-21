const path = require('path');

/**
 * Creates the FAQ table in the database
 * @param {Database} db - SQLite database connection
 */
function createFaqTable(db) {
  return new Promise((resolve, reject) => {
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
        reject(err);
      } else {
        console.log('FAQ table created or already exists');
        resolve();
      }
    });
  });
}

module.exports = createFaqTable;