const mineflayer = require("mineflayer");

const bot = mineflayer.createBot({
  host: "enchanted.kingsnetwork.uk",
  port: 25813,
  username: "RenderBot",
  auth: "offline"
});

console.log("Starting King’s Network KeepAlive bot...");

bot.on("login", () => {
  console.log("Logged into enchanted.kingsnetwork.uk");
});

bot.on("spawn", () => {
  console.log("Bot spawned!");

  // Anti-AFK movement
  setInterval(() => {
    bot.setControlState("jump", true);
    setTimeout(() => bot.setControlState("jump", false), 500);
  }, 20000);
});

bot.on("kicked", reason => {
  console.log("Kicked:", reason);
  setTimeout(() => process.exit(), 5000);
});

bot.on("error", err => {
  console.log("Error:", err.message);
});
