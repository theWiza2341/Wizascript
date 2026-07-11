if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { Client, GatewayIntentBits, ChannelType } = require("discord.js");
const fs = require("fs");
const path = require("path");
const {
  extractDeckCode,
  normalizeDeckCode,
  extractRecord,
  extractCreator,
  resolveUser,
  fetchAllMessages,
  matchSeasonCategory,
  getContextWindow
} = require("./lib/deck-scraping");

const OUTPUT_PATH = path.join(__dirname, "decks.json");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let added = 0;
let updated = 0;

function loadExistingDecks() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    console.log("No decks.json found — will do a full scan.");
    return [];
  }
  try {
    const raw = fs.readFileSync(OUTPUT_PATH, "utf8");
    return JSON.parse(raw).decks ?? [];
  } catch {
    console.log("Failed to read decks.json — will do a full scan.");
    return [];
  }
}

function saveDecks(decks) {
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ decks }, null, 2), "utf8");
  console.log("\n✔ decks.json updated");
}

async function processChannel(channel, { existingDecks, existingByChannel, existingByMessage, isNewSeason }) {
  const messages = await fetchAllMessages(channel);
  if (!messages.length) {
    console.log("  No messages.");
    return { result: "skip" };
  }

  const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  if (!isNewSeason) {
    const unseen = sorted.filter(msg => !existingByMessage.has(msg.id));
    if (unseen.length === 0) {
      console.log("  No new messages — skipping.");
      return { result: "skip" };
    }
  }

  let deckMessage = null;
  let deckCode = null;

  for (const msg of sorted) {
    const code = extractDeckCode(msg.content);
    if (code) {
      deckMessage = msg;
      deckCode = code;
      console.log(`  Found deck code (${sorted.indexOf(msg) + 1}/${sorted.length})`);
      break;
    }
  }

  if (!deckMessage) {
    console.log("  No deck found. Message previews:");
    sorted.slice(0, 10).forEach((msg, i) => {
      console.log(`    [${i + 1}] ${msg.content.slice(0, 80).replace(/\n/g, " ")}`);
    });
    return { result: "skip" };
  }

  const actualIndex = sorted.findIndex(msg => msg.id === deckMessage.id);
  const contextWindow = getContextWindow(sorted, actualIndex);

  let record = null;
  let author = deckMessage.author.username;

  for (const msg of contextWindow) {
    if (!record) record = extractRecord(msg.content);

    const creator = extractCreator(msg.content);
    if (creator) {
      const resolved = await resolveUser(client, creator);
      if (resolved) author = resolved;
    }
  }

  const normalizedCode = normalizeDeckCode(deckCode);
  const channelKey = `${channel.parent?.name}:${channel.name}`;

  const deckData = {
    messageId: deckMessage.id,
    season: channel.parent?.name,
    channel: channel.name,
    author,
    deckCode: normalizedCode,
    record,
    notes: contextWindow.map(msg => msg.content).join("\n\n").replace(deckCode, "").trim(),
    publishedAt: deckMessage.createdAt.toISOString()
  };

  const existing = existingByChannel.get(channelKey);

  if (!existing) {
    existingDecks.push(deckData);
    existingByChannel.set(channelKey, deckData);
    existingByMessage.add(deckMessage.id);
    added++;
    console.log("  ✔ Added");
    return { result: "added" };
  }

  if (existing.deckCode !== normalizedCode) {
    const index = existingDecks.findIndex(deck => deck.messageId === existing.messageId);
    if (index !== -1) existingDecks[index] = deckData;
    else existingDecks.push(deckData);

    existingByChannel.set(channelKey, deckData);
    existingByMessage.add(deckMessage.id);
    updated++;
    console.log("  ✔ Updated");
    return { result: "updated" };
  }

  console.log("  No changes.");
  return { result: "unchanged" };
}

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const guild = client.guilds.cache.first();
  if (!guild) {
    console.log("No guilds found.");
    client.destroy();
    return;
  }

  console.log(`\nScanning "${guild.name}"...`);

  const existingDecks = loadExistingDecks();
  console.log(`Loaded ${existingDecks.length} existing deck(s).`);

  const existingByChannel = new Map();
  const existingByMessage = new Set();

  for (const deck of existingDecks) {
    if (deck.season && deck.channel) existingByChannel.set(`${deck.season}:${deck.channel}`, deck);
    if (deck.messageId) existingByMessage.add(deck.messageId);
  }

  let latestSeason = null;
  if (existingDecks.length > 0) {
    const seasonNumbers = existingDecks
      .map(deck => matchSeasonCategory(String(deck.season)))
      .filter(n => n !== null);
    if (seasonNumbers.length > 0) latestSeason = Math.max(...seasonNumbers);
  }

  console.log(
    latestSeason !== null
      ? `Latest known season: s${latestSeason}`
      : "No previous season detected — scanning all seasons."
  );

  const channels = await guild.channels.fetch();
  const currentSeasonChannels = [];
  const newSeasonChannels = [];

  channels.forEach(channel => {
    if (!channel) return;
    const parentName = channel.parent?.name ?? "";
    const isText = channel.type === ChannelType.GuildText;
    const seasonNumber = matchSeasonCategory(parentName);
    if (!isText || seasonNumber === null) return;

    if (latestSeason === null || seasonNumber > latestSeason) {
      newSeasonChannels.push(channel);
    } else if (seasonNumber === latestSeason) {
      currentSeasonChannels.push(channel);
    }
  });

  console.log(`New season channels to scan: ${newSeasonChannels.length}`);
  console.log(`Current season channels to check: ${currentSeasonChannels.length}`);

  if (newSeasonChannels.length > 0) {
    const newSeasonNames = [...new Set(newSeasonChannels.map(c => c.parent?.name))].join(", ");
    console.log(`\n🆕 New season(s) discovered: ${newSeasonNames}`);
  }

  const context = { existingDecks, existingByChannel, existingByMessage };

  if (newSeasonChannels.length > 0) {
    console.log("\n--- Scanning new season(s) ---");
    for (const channel of newSeasonChannels) {
      console.log(`\n#${channel.name} [${channel.parent?.name}]`);
      try {
        await processChannel(channel, { ...context, isNewSeason: true });
      } catch (error) {
        console.error(`  Failed:`, error.message);
      }
    }
  }

  if (currentSeasonChannels.length > 0) {
    console.log("\n--- Checking current season for updates ---");
    for (const channel of currentSeasonChannels) {
      console.log(`\n#${channel.name} [${channel.parent?.name}]`);
      try {
        await processChannel(channel, { ...context, isNewSeason: false });
      } catch (error) {
        console.error(`  Failed:`, error.message);
      }
    }
  }

  saveDecks(existingDecks);

  console.log("\n======================");
  console.log(`Added:   ${added}`);
  console.log(`Updated: ${updated}`);
  console.log(`Total:   ${existingDecks.length}`);
  console.log("======================\n");

  client.destroy();
});

client.login(process.env.BOT_TOKEN);
