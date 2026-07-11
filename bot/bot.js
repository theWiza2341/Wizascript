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

function exportDecksToFile(decks) {
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ decks }, null, 2), "utf-8");
  console.log("\n✔ decks.json updated");
}

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const guild = client.guilds.cache.first();
  if (!guild) {
    console.log("No guilds found.");
    client.destroy();
    return;
  }

  const channels = await guild.channels.fetch();
  const relevantChannels = [];

  channels.forEach(ch => {
    if (!ch) return;
    const parentName = ch.parent?.name ?? "";
    const isText = ch.type === ChannelType.GuildText;
    if (isText && matchSeasonCategory(parentName) !== null) {
      relevantChannels.push(ch);
    }
  });

  console.log(`Found ${relevantChannels.length} relevant channels\n`);

  const finalDecks = [];

  for (const channel of relevantChannels) {
    console.log(`Scanning #${channel.name}`);

    try {
      const messages = await fetchAllMessages(channel);
      if (!messages.length) {
        console.log("  No messages.");
        continue;
      }

      const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

      let deckIndex = -1;
      let deckMessage = null;
      let deckCode = null;

      for (let i = 0; i < sorted.length; i++) {
        const code = extractDeckCode(sorted[i].content);
        if (code) {
          deckIndex = i;
          deckMessage = sorted[i];
          deckCode = code;
          break;
        }
      }

      if (!deckMessage) {
        console.log("  No deck found.");
        continue;
      }

      const contextWindow = getContextWindow(sorted, deckIndex, { fromStart: true });

      let record = null;
      // Defaults to the deck-code message's own author, not the
      // channel's first poster - fixes a misattribution bug from the
      // original bot.js where a deck posted a few messages into a
      // thread (after some commentary) got credited to whoever posted
      // first instead.
      let authorName = deckMessage.author.username;

      for (const msg of contextWindow) {
        if (!record) record = extractRecord(msg.content);

        const creator = extractCreator(msg.content);
        if (creator) {
          const resolved = await resolveUser(client, creator);
          if (resolved) authorName = resolved;
        }
      }

      const cleanedNotes = contextWindow
        .map(m => m.content)
        .join("\n\n")
        .replace(deckCode, "")
        .trim();

      finalDecks.push({
        messageId: deckMessage.id,
        season: channel.parent?.name,
        channel: channel.name,
        author: authorName,
        deckCode: normalizeDeckCode(deckCode),
        record,
        notes: cleanedNotes,
        publishedAt: deckMessage.createdAt.toISOString()
      });

      console.log("  ✔ Parsed deck");
    } catch (err) {
      console.error(`  Failed #${channel.name}:`, err.message);
    }
  }

  exportDecksToFile(finalDecks);

  console.log("\n======================");
  console.log(`TOTAL DECKS FOUND: ${finalDecks.length}`);
  console.log("======================\n");

  client.destroy();
});

client.login(process.env.BOT_TOKEN);
