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

const OUTPUT_PATH = path.join(__dirname, "decks.json");

const RECORD_SEARCH_LIMIT = 10;      // requirement 6 - only the first 10 messages
const NOTES_MIN_LENGTH = 100;        // requirement 7 - "long" message threshold

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});


// =====================================================
// LINK STRIPPING
// =====================================================
// Skip everything from "http(s)" (or a bare "www.") up to the next
// whitespace - this is the original, minimal rule. Used both for
// record extraction (so a link's digits never get misread as a
// win/loss count) and for cleaning notes text.

function stripLinks(text) {
    return text
        .replace(/https?:\/\/\S+/gi, " ")
        .replace(/www\.\S+/gi, " ");
}


// =====================================================
// REQUIREMENT 2 - DECK CODE
// =====================================================
// Always starts with "eyJ". Scans ALL messages, oldest to newest, and
// returns the first match - this naturally covers the "manually added
// as basically the last message" case too, without needing to special-
// case message position at all.

function extractDeckCodeFromText(text) {
    if (!text) return null;

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
        const match = line.match(/eyJ[A-Za-z0-9+/=\-_]+/);
        if (match) return match[0];
    }
    return null;
}

function findDeckCode(sorted) {
    for (const msg of sorted) {
        const code = extractDeckCodeFromText(msg.content);
        if (code) return { deckCode: code, deckMessage: msg };
    }
    return { deckCode: null, deckMessage: null };
}


// =====================================================
// REQUIREMENT 6 - RECORD
// =====================================================
// Only checked within the first RECORD_SEARCH_LIMIT messages of the
// channel - if nothing's found there, we stop looking entirely and
// treat the deck as having no known record, rather than continuing to
// search the whole channel.

function extractRecordFromText(text) {
    if (!text) return null;

    const cleaned = stripLinks(text).toLowerCase();
    let match;

    // "15-4" / "15 - 4" / unicode dashes - also matches "going 10-4,
    // and then..." since this isn't anchored to the whole string.
    match = cleaned.match(/(\d{1,3})\s*[-–—]\s*(\d{1,3})/);
    if (match) return { wins: +match[1], losses: +match[2] };

    // "15/4"
    match = cleaned.match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
    if (match) return { wins: +match[1], losses: +match[2] };

    // "15 to 4"
    match = cleaned.match(/(\d{1,3})\s+to\s+(\d{1,3})/);
    if (match) return { wins: +match[1], losses: +match[2] };

    // "15 wins 4 losses"
    match = cleaned.match(/(\d{1,3})\s+wins?\s+(\d{1,3})\s+loss(?:es)?/);
    if (match) return { wins: +match[1], losses: +match[2] };

    // "15 W 4 L"
    match = cleaned.match(/(\d{1,3})\s*w\s*(\d{1,3})\s*l\b/);
    if (match) return { wins: +match[1], losses: +match[2] };

    return null;
}

function findRecord(sorted) {
    const window = sorted.slice(0, Math.min(RECORD_SEARCH_LIMIT, sorted.length));
    for (const msg of window) {
        const record = extractRecordFromText(msg.content);
        if (record) return record;
    }
    // Not found within the first 10 messages - stored as null, which
    // overlay.js already renders as "-" / "-" (visually "-/-") via
    // `deck.record?.wins ?? "-"` and the same for losses. No schema
    // change needed to get that display outcome.
    return null;
}


// =====================================================
// REQUIREMENT 4 - AUTHOR / CREATOR
// =====================================================
// "Creator: <name>" wins if found anywhere; otherwise falls back to
// whoever posted the channel's first message.

function extractCreatorFromText(text) {
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

async function findAuthor(sorted, firstMessage) {
    for (const msg of sorted) {
        const creator = extractCreatorFromText(msg.content);
        if (creator) {
            const resolved = await resolveUser(client, creator);
            if (resolved) return resolved;
        }
    }
    return firstMessage.author.username;
}


// =====================================================
// REQUIREMENT 7 - NOTES
// =====================================================
// The first message whose content is "long" (past NOTES_MIN_LENGTH)
// is treated as the deck's description - rather than concatenating a
// window of several messages together, this picks the one message
// most likely to actually be a real writeup.

function findNotes(sorted, deckCode) {
    const longMessage = sorted.find(msg => msg.content.trim().length >= NOTES_MIN_LENGTH);
    if (!longMessage) return "";

    return stripLinks(longMessage.content)
        .replace(deckCode, "")
        .trim();
}


// =====================================================
// REQUIREMENT 5 - SEASON
// =====================================================
// Usually "SXXX", but can extend further (e.g. "SXXX-dr3&4") - the
// relevant-channel filter below only checks the category name STARTS
// WITH "s" + digits, so an extended name like this already passes
// without any extra handling.

function isRelevantCategory(categoryName) {
    return /^s\d+/i.test(categoryName ?? "");
}


// =====================================================
// FULL HISTORY FETCHER
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

        if (all.length > 5000) break; // safety cap
    }

    return all;
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
        const isText = ch.type === ChannelType.GuildText;
        if (isText && isRelevantCategory(ch.parent?.name)) {
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

            // Requirement 1: publishedAt is always the channel's very
            // first message, no adjustment.
            const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
            const firstMessage = sorted[0];

            const { deckCode, deckMessage } = findDeckCode(sorted);
            if (!deckCode) {
                console.log("  No deck found.");
                continue;
            }

            const record = findRecord(sorted);
            const author = await findAuthor(sorted, firstMessage);
            const notes = findNotes(sorted, deckCode);

            finalDecks.push({
                messageId: deckMessage.id,
                season: channel.parent?.name,
                // Requirement 3: hyphens -> spaces for the stored name.
                // Full-sync does a fresh export every run (no lookup-
                // by-channel-name merging like new-only-sync does), so
                // it's safe to store the display-formatted value
                // directly rather than needing a second raw field.
                channel: channel.name.replace(/-/g, " "),
                author,
                deckCode,
                record,
                notes,
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
