if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const {
    Client,
    GatewayIntentBits,
    ChannelType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// FIX: this previously had `path.join(__dirname, "..", "decks.json")`.
// Since this script runs with __dirname === the bot/ folder itself,
// the ".." stepped OUT of bot/ entirely, writing to <repo-root>/
// decks.json - a completely different file than bot/decks.json, which
// is the one the GitHub Action actually commits (`git add
// bot/decks.json`) and the one the userscript fetches. That mismatch
// is exactly why a full sync appeared to run successfully but
// bot/decks.json never changed.
const OUTPUT_PATH = path.join(__dirname, "decks.json");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});


// =====================================================
// HELPERS
// =====================================================

function extractDeckCode(text) {
    if (!text) return null;

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
        const match = line.match(/eyJ[A-Za-z0-9+/=\-_]+/);
        if (match) return match[0];
    }

    return null;
}

function extractRecord(text) {
    if (!text) return null;

    const cleaned = text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/www\.\S+/gi, "")
    // FIX (bug 3): the two rules above only strip links that already
    // have a protocol/www prefix - a bare pasted domain (e.g. an image
    // link like "cdn.discordapp.com/attachments/...") slips through
    // untouched, and a stray run of digits inside it could then get
    // misread as a win/loss record. This catches those too.
    .replace(/\b[\w-]+\.(com|net|org|gg|io|png|jpg|jpeg|gif|webp)\S*/gi, "")
    .toLowerCase();

    let match;

    match = cleaned.match(/(\d{1,3})\s*[-–—]\s*(\d{1,3})/);
    if (match) return { wins: +match[1], losses: +match[2] };

    match = cleaned.match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
    if (match) return { wins: +match[1], losses: +match[2] };

    match = cleaned.match(/(\d{1,3})\s+to\s+(\d{1,3})/);
    if (match) return { wins: +match[1], losses: +match[2] };

    match = cleaned.match(/(\d{1,3})\s+wins?\s+(\d{1,3})\s+loss(?:es)?/);
    if (match) return { wins: +match[1], losses: +match[2] };

    match = cleaned.match(/(\d{1,3})\s*w\s*(\d{1,3})\s*l\b/);
    if (match) return { wins: +match[1], losses: +match[2] };

    return null;
}

function extractCreator(text) {
    if (!text) return null;

    const lower = text.toLowerCase();
    if (!lower.includes("creator")) return null;

    let match = text.match(/<@!?(\d+)>/);
    if (match) return { type: "id", value: match[1] };

    match = text.match(/creator[:\s]+@?([\w\-]+)/i);
    if (match) return { type: "name", value: match[1] };

    return null;
}

async function resolveUser(client, creator) {
    try {
        if (creator.type === "id") {
            const user = await client.users.fetch(creator.value);
            return user.username;
        }
        return creator.value;
    } catch {
        return null;
    }
}

function exportDecksToFile(decks) {
    fs.writeFileSync(
        OUTPUT_PATH,
        JSON.stringify({ decks }, null, 2),
        "utf-8"
    );

    console.log("\n✔ decks.json updated");
}


// =====================================================
// 🔥 PAGINATED CHANNEL SCANNER (FIX)
// =====================================================

async function fetchAllMessages(channel) {

    let all = [];
    let lastId = null;

    while (true) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const batch = await channel.messages.fetch(options);

        if (!batch.size) break;

        const msgs = [...batch.values()];
        all.push(...msgs);

        lastId = msgs[msgs.length - 1].id;

        // safety cap (prevents infinite runaway in huge channels)
        if (all.length > 5000) break;
    }

    return all;
}


// =====================================================
// MAIN
// =====================================================

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

        const parent = ch.parent?.name ?? "";
        const isText = ch.type === ChannelType.GuildText;

        if (isText && /^s\d+/i.test(parent)) {
            relevantChannels.push(ch);
        }
    });

    console.log(`Found ${relevantChannels.length} relevant channels\n`);

    const finalDecks = [];

    // =====================================================
    // PROCESS
    // =====================================================
    for (const channel of relevantChannels) {

        console.log(`Scanning #${channel.name}`);

        try {

            // 🔥 FULL HISTORY FETCH
            const messages = await fetchAllMessages(channel);

            if (!messages.length) {
                console.log("  No messages.");
                continue;
            }

            // oldest → newest
            const sorted = messages
                .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
            
            const firstMessage = sorted[0];

            // =================================================
            // FIND FIRST VALID DECK
            // =================================================
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

            // =================================================
            // CONTEXT WINDOW
            // =================================================
            const window = sorted.slice(
                0,
                Math.min(sorted.length, deckIndex + 5)
            );

            let record = null;
            let authorName = firstMessage.author.username;

            for (const msg of window) {

                // FIX (bug 3): skip messages that are just an image/
                // file with no real text - these have empty .content,
                // so extractRecord/extractCreator would just return
                // null anyway, but being explicit here documents the
                // intent and protects against any future content-
                // stripping edge case letting something slip through.
                const isAttachmentOnly = msg.attachments.size > 0 && !msg.content.trim();
                if (isAttachmentOnly) continue;

                if (!record) {
                    record = extractRecord(msg.content);
                }

                const creator = extractCreator(msg.content);
                if (creator) {
                    const resolved = await resolveUser(client, creator);
                    if (resolved) authorName = resolved;
                }
            }

            const cleanedNotes = window
                .map(m => m.content)
                .join("\n\n")
                .replace(deckCode, "")
                .trim();

            finalDecks.push({
                messageId: deckMessage.id,
                season: channel.parent?.name,
                channel: channel.name,
                author: authorName,
                deckCode,
                record,
                notes: cleanedNotes,
                // Already correct in this script - uses the CHANNEL'S
                // first message, not the deck-code message's own
                // timestamp (bug 1 was specifically about the latter).
                publishedAt: firstMessage.createdAt.toISOString()
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

client.login(process.env.BOT_TOKEN);if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const {
    Client,
    GatewayIntentBits,
    ChannelType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// FIX: this previously had `path.join(__dirname, "..", "decks.json")`.
// Since this script runs with __dirname === the bot/ folder itself,
// the ".." stepped OUT of bot/ entirely, writing to <repo-root>/
// decks.json - a completely different file than bot/decks.json, which
// is the one the GitHub Action actually commits (`git add
// bot/decks.json`) and the one the userscript fetches. That mismatch
// is exactly why a full sync appeared to run successfully but
// bot/decks.json never changed.
const OUTPUT_PATH = path.join(__dirname, "decks.json");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});


// =====================================================
// HELPERS
// =====================================================

function extractDeckCode(text) {
    if (!text) return null;

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
        const match = line.match(/eyJ[A-Za-z0-9+/=\-_]+/);
        if (match) return match[0];
    }

    return null;
}

function extractRecord(text) {
    if (!text) return null;

    const cleaned = text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/www\.\S+/gi, "")
    // FIX (bug 3): the two rules above only strip links that already
    // have a protocol/www prefix - a bare pasted domain (e.g. an image
    // link like "cdn.discordapp.com/attachments/...") slips through
    // untouched, and a stray run of digits inside it could then get
    // misread as a win/loss record. This catches those too.
    .replace(/\b[\w-]+\.(com|net|org|gg|io|png|jpg|jpeg|gif|webp)\S*/gi, "")
    .toLowerCase();

    let match;

    match = cleaned.match(/(\d{1,3})\s*[-–—]\s*(\d{1,3})/);
    if (match) return { wins: +match[1], losses: +match[2] };

    match = cleaned.match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
    if (match) return { wins: +match[1], losses: +match[2] };

    match = cleaned.match(/(\d{1,3})\s+to\s+(\d{1,3})/);
    if (match) return { wins: +match[1], losses: +match[2] };

    match = cleaned.match(/(\d{1,3})\s+wins?\s+(\d{1,3})\s+loss(?:es)?/);
    if (match) return { wins: +match[1], losses: +match[2] };

    match = cleaned.match(/(\d{1,3})\s*w\s*(\d{1,3})\s*l\b/);
    if (match) return { wins: +match[1], losses: +match[2] };

    return null;
}

function extractCreator(text) {
    if (!text) return null;

    const lower = text.toLowerCase();
    if (!lower.includes("creator")) return null;

    let match = text.match(/<@!?(\d+)>/);
    if (match) return { type: "id", value: match[1] };

    match = text.match(/creator[:\s]+@?([\w\-]+)/i);
    if (match) return { type: "name", value: match[1] };

    return null;
}

async function resolveUser(client, creator) {
    try {
        if (creator.type === "id") {
            const user = await client.users.fetch(creator.value);
            return user.username;
        }
        return creator.value;
    } catch {
        return null;
    }
}

function exportDecksToFile(decks) {
    fs.writeFileSync(
        OUTPUT_PATH,
        JSON.stringify({ decks }, null, 2),
        "utf-8"
    );

    console.log("\n✔ decks.json updated");
}


// =====================================================
// 🔥 PAGINATED CHANNEL SCANNER (FIX)
// =====================================================

async function fetchAllMessages(channel) {

    let all = [];
    let lastId = null;

    while (true) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const batch = await channel.messages.fetch(options);

        if (!batch.size) break;

        const msgs = [...batch.values()];
        all.push(...msgs);

        lastId = msgs[msgs.length - 1].id;

        // safety cap (prevents infinite runaway in huge channels)
        if (all.length > 5000) break;
    }

    return all;
}


// =====================================================
// MAIN
// =====================================================

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

        const parent = ch.parent?.name ?? "";
        const isText = ch.type === ChannelType.GuildText;

        if (isText && /^s\d+/i.test(parent)) {
            relevantChannels.push(ch);
        }
    });

    console.log(`Found ${relevantChannels.length} relevant channels\n`);

    const finalDecks = [];

    // =====================================================
    // PROCESS
    // =====================================================
    for (const channel of relevantChannels) {

        console.log(`Scanning #${channel.name}`);

        try {

            // 🔥 FULL HISTORY FETCH
            const messages = await fetchAllMessages(channel);

            if (!messages.length) {
                console.log("  No messages.");
                continue;
            }

            // oldest → newest
            const sorted = messages
                .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
            
            const firstMessage = sorted[0];

            // =================================================
            // FIND FIRST VALID DECK
            // =================================================
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

            // =================================================
            // CONTEXT WINDOW
            // =================================================
            const window = sorted.slice(
                0,
                Math.min(sorted.length, deckIndex + 5)
            );

            let record = null;
            let authorName = firstMessage.author.username;

            for (const msg of window) {

                // FIX (bug 3): skip messages that are just an image/
                // file with no real text - these have empty .content,
                // so extractRecord/extractCreator would just return
                // null anyway, but being explicit here documents the
                // intent and protects against any future content-
                // stripping edge case letting something slip through.
                const isAttachmentOnly = msg.attachments.size > 0 && !msg.content.trim();
                if (isAttachmentOnly) continue;

                if (!record) {
                    record = extractRecord(msg.content);
                }

                const creator = extractCreator(msg.content);
                if (creator) {
                    const resolved = await resolveUser(client, creator);
                    if (resolved) authorName = resolved;
                }
            }

            const cleanedNotes = window
                .map(m => m.content)
                .join("\n\n")
                .replace(deckCode, "")
                .trim();

            finalDecks.push({
                messageId: deckMessage.id,
                season: channel.parent?.name,
                channel: channel.name,
                author: authorName,
                deckCode,
                record,
                notes: cleanedNotes,
                // Already correct in this script - uses the CHANNEL'S
                // first message, not the deck-code message's own
                // timestamp (bug 1 was specifically about the latter).
                publishedAt: firstMessage.createdAt.toISOString()
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
