# 🏪 Gambler's Den Discord Bot

A feature-rich Discord bot for managing a pet shop with ticket system, order management, and smart inventory tracking.

## ✨ Features

### 🎫 **Ticket System**
- Support ticket creation with modal forms
- Ticket processing and completion workflows
- Automatic channel archiving
- Transcript generation

### 🛒 **Order Management**
- Smart item matching with misspelling detection
- Acronym and partial matching support
- Order processing and completion
- Inventory tracking

### 📦 **Stock Management**
- Dynamic stock embed with real-time updates
- Smart item removal with confirmation buttons
- Beautiful, readable inventory display
- Low stock alerts

### ❓ **FAQ System**
- Dynamic FAQ management
- Easy editing and reordering
- Persistent storage

## 🚀 Setup

### Prerequisites
- Node.js (v16 or higher)
- Discord Bot Token
- Discord Server with appropriate permissions

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd oakmont
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables**
   ```env
   DISCORD_TOKEN=your_bot_token_here
   ADMIN_ROLE_ID=your_admin_role_id
   USER_ROLE_ID=your_user_role_id
   TICKETS_OPEN_CATEGORY=your_open_category_id
   TICKETS_PROCESSING_CATEGORY=your_processing_category_id
   TICKETS_ARCHIVED_CATEGORY=your_archived_category_id
   SHOP_CHANNEL_ID=your_shop_channel_id
   TICKETS_LOGS_CHANNEL=your_logs_channel_id
   ```

5. **Deploy slash commands**
   ```bash
   node deploy-commands.js
   ```

6. **Start the bot**
   ```bash
   node index.js
   ```

## 📋 Commands

### Admin Commands
- `/helpdesk` - Create help desk panels
- `/stock add` - Add items to inventory
- `/stock remove` - Remove items (with smart matching)
- `/stock update` - Update stock display
- `/stock list` - List all inventory items
- `/setup-order-button` - Create order button

### User Commands
- `/ticket` - Ticket management commands
- `/faq` - FAQ management

## 🎯 Smart Features

### **Intelligent Item Matching**
- **Misspelling Detection**: Uses Levenshtein distance
- **Acronym Support**: Recognizes abbreviations
- **Partial Matching**: Finds items containing search terms
- **Confidence Scoring**: Shows match accuracy

### **User-Friendly Interface**
- **Confirmation Buttons**: Yes/No buttons for actions
- **Smart Suggestions**: Helpful alternatives when no match found
- **Real-time Updates**: Live inventory tracking
- **Beautiful Embeds**: Professional-looking displays

## 🔧 Configuration

### Required Discord Permissions
- Manage Channels
- Manage Messages
- Send Messages
- Use Slash Commands
- Read Message History

### Channel Setup
1. Create categories for tickets (open, processing, archived)
2. Set up shop channel for inventory display
3. Configure logs channel for transcript storage

## 📁 Project Structure

```
oakmont/
├── commands/          # Slash command definitions
├── events/           # Discord event handlers
├── handlers/         # Modular business logic
├── utils/            # Utility functions
├── db/              # Database files (gitignored)
├── transcripts/     # Ticket transcripts (gitignored)
├── index.js         # Main bot file
└── deploy-commands.js # Command deployment
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, please open an issue on GitHub or contact the development team. 