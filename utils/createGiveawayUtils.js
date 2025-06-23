// Utility to parse duration strings like '1h', '2d', '7d', '10min', '15minutes', etc. into milliseconds
function parseDuration(str) {
   if (!str || typeof str !== 'string') return null;
   const s = str.trim().toLowerCase();
   // Match patterns like 10m, 10min, 10mins, 10minute, 10minutes, etc.
   const match = s.match(/^(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)$/);
   if (!match) return null;
   const value = parseInt(match[1], 10);
   const unit = match[2];
   switch (unit) {
      case 's': case 'sec': case 'secs': case 'second': case 'seconds':
         return value * 1000;
      case 'm': case 'min': case 'mins': case 'minute': case 'minutes':
         return value * 60 * 1000;
      case 'h': case 'hr': case 'hrs': case 'hour': case 'hours':
         return value * 60 * 60 * 1000;
      case 'd': case 'day': case 'days':
         return value * 24 * 60 * 60 * 1000;
      case 'w': case 'week': case 'weeks':
         return value * 7 * 24 * 60 * 60 * 1000;
      default:
         return null;
   }
}

module.exports = { parseDuration }; 