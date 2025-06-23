// Utility to parse duration strings like '1h', '2d', '7d', etc. into milliseconds
function parseDuration(str) {
   if (!str || typeof str !== 'string') return null;
   const match = str.trim().toLowerCase().match(/^(\d+)([smhdw])$/);
   if (!match) return null;
   const value = parseInt(match[1], 10);
   const unit = match[2];
   switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'w': return value * 7 * 24 * 60 * 60 * 1000;
      default: return null;
   }
}

module.exports = { parseDuration }; 