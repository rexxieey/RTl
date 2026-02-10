const mineflayer = require('mineflayer');

// Configuration - use environment variables for security
const config = {
  host: process.env.MC_HOST || 'localhost',
  port: parseInt(process.env.MC_PORT) || 25565,
  username: process.env.MC_USERNAME || 'KeepAliveBot',
  version: process.env.MC_VERSION || false, // Auto-detect version
  auth: process.env.MC_AUTH || 'offline', // 'microsoft' or 'offline'
  hideErrors: false,
  checkTimeoutInterval: 60000, // 60 seconds
  keepAlive: true,
  closeTimeout: 60000
};

// Optional: Add password if needed
if (process.env.MC_PASSWORD) {
  config.password = process.env.MC_PASSWORD;
}

console.log(`Starting Minecraft Keep-Alive Bot v2.0...`);
console.log(`Connecting to ${config.host}:${config.port} as ${config.username}`);

// State management
let bot = null;
let reconnectAttempts = 0;
let isConnecting = false;
let isShuttingDown = false;
let antiAfkInterval = null;
let statusInterval = null;
let lastSuccessfulConnection = null;

// Exponential backoff for reconnection
function getReconnectDelay() {
  const baseDelay = 5000; // 5 seconds
  const maxDelay = 300000; // 5 minutes
  const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts), maxDelay);
  return delay + Math.random() * 2000; // Add jitter
}

function cleanup() {
  // Clear all intervals
  if (antiAfkInterval) {
    clearInterval(antiAfkInterval);
    antiAfkInterval = null;
  }
  
  if (statusInterval) {
    clearInterval(statusInterval);
    statusInterval = null;
  }
}

function createBot() {
  // Prevent multiple simultaneous connection attempts
  if (isConnecting || isShuttingDown) {
    console.log('⏳ Already connecting or shutting down, skipping...');
    return;
  }

  isConnecting = true;
  console.log(`\n[${new Date().toISOString()}] Connecting... (Attempt ${reconnectAttempts + 1})`);

  try {
    bot = mineflayer.createBot(config);
  } catch (err) {
    console.error(`✗ Failed to create bot: ${err.message}`);
    isConnecting = false;
    scheduleReconnect();
    return;
  }

  // Connection successful
  bot.once('login', () => {
    console.log(`✓ Bot logged in successfully!`);
    console.log(`✓ Connected to: ${config.host}:${config.port}`);
    isConnecting = false;
    reconnectAttempts = 0; // Reset on successful connection
    lastSuccessfulConnection = Date.now();
  });

  // Bot spawned in world
  bot.once('spawn', () => {
    console.log(`✓ Bot spawned in the world`);
    if (bot.entity && bot.entity.position) {
      console.log(`Position: ${bot.entity.position}`);
    }
    
    // Setup anti-AFK movements
    setupAntiAFK();
    
    // Setup status logging
    if (!statusInterval) {
      statusInterval = setInterval(() => {
        const uptime = Math.floor(process.uptime());
        const connectedTime = lastSuccessfulConnection ? 
          Math.floor((Date.now() - lastSuccessfulConnection) / 1000) : 0;
        console.log(`[KEEPALIVE] Bot active | Uptime: ${uptime}s | Connected: ${connectedTime}s`);
      }, 120000); // Every 2 minutes
    }
  });

  // Health monitoring
  bot.on('health', () => {
    // Only log significant health changes
    if (bot.health <= 5 || bot.food <= 5) {
      console.log(`⚠ Health: ${bot.health} | Food: ${bot.food}`);
    }
    
    // Auto-respawn if died
    if (bot.health === 0) {
      console.log('💀 Bot died, attempting respawn...');
      setTimeout(() => {
        try {
          bot.chat('/respawn');
        } catch (err) {
          console.log('Respawn failed, will reconnect on next cycle');
        }
      }, 2000);
    }
  });

  // Handle kicks
  bot.on('kicked', (reason) => {
    console.log(`✗ Bot was kicked: ${reason}`);
    cleanup();
    isConnecting = false;
    scheduleReconnect();
  });

  // Handle errors
  bot.on('error', (err) => {
    console.error(`✗ Error: ${err.message}`);
    
    // Don't spam reconnects on persistent errors
    if (err.message.includes('Invalid credentials') || 
        err.message.includes('Failed to verify username')) {
      console.error('⚠ FATAL: Authentication error. Check your credentials!');
      console.error('Set MC_AUTH=offline for cracked servers or MC_AUTH=microsoft with valid credentials');
      isShuttingDown = true;
      cleanup();
      process.exit(1);
    }
    
    cleanup();
    isConnecting = false;
    scheduleReconnect();
  });

  // Handle disconnection
  bot.on('end', (reason) => {
    console.log(`✗ Connection ended: ${reason || 'Unknown reason'}`);
    cleanup();
    isConnecting = false;
    
    if (!isShuttingDown) {
      scheduleReconnect();
    }
  });

  // Chat message handler (minimal logging)
  bot.on('message', (message) => {
    const msg = message.toString();
    
    // Only log messages that mention the bot or are from server
    if (msg.includes(config.username) || msg.startsWith('[Server]')) {
      console.log(`[CHAT] ${msg}`);
      
      // Respond to status requests
      if (msg.toLowerCase().includes('status') || msg.toLowerCase().includes('alive')) {
        try {
          const uptime = Math.floor(process.uptime());
          bot.chat(`✓ Online | Uptime: ${uptime}s`);
        } catch (err) {
          // Ignore chat errors
        }
      }
    }
  });

  return bot;
}

function setupAntiAFK() {
  // Clear existing interval if any
  if (antiAfkInterval) {
    clearInterval(antiAfkInterval);
  }
  
  // Subtle movements to avoid AFK kick
  antiAfkInterval = setInterval(() => {
    if (bot && bot.entity) {
      try {
        // Small random look movements
        const yaw = bot.entity.yaw + (Math.random() - 0.5) * 0.2;
        const pitch = bot.entity.pitch + (Math.random() - 0.5) * 0.1;
        bot.look(yaw, pitch);
      } catch (err) {
        // Ignore movement errors
      }
    }
  }, 45000); // Every 45 seconds
}

function scheduleReconnect() {
  if (isShuttingDown) {
    return;
  }
  
  const delay = getReconnectDelay();
  reconnectAttempts++;
  
  console.log(`⏳ Reconnecting in ${(delay / 1000).toFixed(1)} seconds... (Attempt ${reconnectAttempts})`);
  
  setTimeout(() => {
    if (!isShuttingDown) {
      createBot();
    }
  }, delay);
}

// Graceful shutdown handlers
function shutdown() {
  if (isShuttingDown) return;
  
  console.log('\n⏹ Shutting down bot gracefully...');
  isShuttingDown = true;
  cleanup();
  
  if (bot) {
    try {
      bot.quit();
    } catch (err) {
      // Ignore quit errors
    }
  }
  
  setTimeout(() => {
    console.log('✓ Bot stopped');
    process.exit(0);
  }, 1000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠ Unhandled Rejection:', reason);
  // Don't crash on unhandled rejections
});

// Start the bot
console.log('🚀 Initializing bot...\n');
createBot();
