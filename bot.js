const mineflayer = require('mineflayer');

// Configuration - use environment variables for security
const config = {
  host: process.env.MC_HOST || 'localhost',
  port: parseInt(process.env.MC_PORT) || 25565,
  username: process.env.MC_USERNAME || 'KeepAliveBot',
  version: process.env.MC_VERSION || false, // Auto-detect version
  auth: process.env.MC_AUTH || 'offline' // 'microsoft' or 'offline'
};

// Optional: Add password if needed
if (process.env.MC_PASSWORD) {
  config.password = process.env.MC_PASSWORD;
}

console.log(`Starting Minecraft Keep-Alive Bot...`);
console.log(`Connecting to ${config.host}:${config.port} as ${config.username}`);

function createBot() {
  const bot = mineflayer.createBot(config);

  bot.on('login', () => {
    console.log(`✓ Bot logged in successfully!`);
    console.log(`✓ Connected to: ${config.host}:${config.port}`);
  });

  bot.on('spawn', () => {
    console.log(`✓ Bot spawned in the world`);
    console.log(`Position: ${bot.entity.position}`);
    
    // Anti-AFK: Look around occasionally
    setInterval(() => {
      bot.look(bot.entity.yaw + Math.random() * 0.1, bot.entity.pitch + Math.random() * 0.1);
    }, 30000); // Every 30 seconds
  });

  bot.on('health', () => {
    console.log(`Health: ${bot.health} | Food: ${bot.food}`);
    
    // Auto-respawn if died
    if (bot.health === 0) {
      console.log('Bot died, respawning...');
      bot.chat('/respawn');
    }
  });

  bot.on('kicked', (reason) => {
    console.log(`✗ Bot was kicked: ${reason}`);
    console.log('Reconnecting in 10 seconds...');
    setTimeout(createBot, 10000);
  });

  bot.on('error', (err) => {
    console.error(`✗ Error: ${err.message}`);
    if (err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT')) {
      console.log('Connection failed, retrying in 30 seconds...');
      setTimeout(createBot, 30000);
    }
  });

  bot.on('end', () => {
    console.log('✗ Connection ended, reconnecting in 10 seconds...');
    setTimeout(createBot, 10000);
  });

  bot.on('message', (message) => {
    const msg = message.toString();
    console.log(`[CHAT] ${msg}`);
    
    // Optional: Respond to specific commands
    if (msg.includes(config.username) && msg.toLowerCase().includes('status')) {
      bot.chat('Keep-alive bot is running! Uptime: ' + process.uptime().toFixed(0) + 's');
    }
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down bot gracefully...');
    bot.quit();
    process.exit(0);
  });

  return bot;
}

// Start the bot
createBot();

// Keep the process alive
setInterval(() => {
  console.log(`[KEEPALIVE] Bot running - Uptime: ${process.uptime().toFixed(0)}s`);
}, 300000); // Log every 5 minutes
