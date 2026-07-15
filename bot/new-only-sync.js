if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const {
    Client,
    GatewayIntentBits,
    ChannelType
} = require("discord.js");

const path = require("path");
const fs = require("fs");

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

function normalizeDeckCode(code) {
    if (!code) return null;
    code = code.replace(/-/g, "+").replace(/_/g, "/");
    while (code.length % 4 !== 0) code += "=";
    return code;
}

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
// channel - if nothing's found there, the deck is treated as having no
// known record rather than continuing to search further.

function extractRecordFromText(text) {
    if (!text) return null;

    const cleaned = stripLinks(text).toLowerCase();
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

function findRecord(sorted) {
    const window = sorted.slice(0, Math.min(RECORD_SEARCH_LIMIT, sorted.length));
    for (const msg of window) {
        const record = extractRecordFromText(msg.content);
        if (record) return record;
    }
    // Not found within the first 10 messages - stored as null, which
    // overlay.js already renders as "-" / "-" (visually "-/-").
    return null;
}


// =====================================================
// REQUIREMENT 4 - AUTHOR / CREATOR
// =====================================================

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
// Usually "SXXX", but can extend further (e.g. "SXXX-dr3&4"). Both the
// category filter AND the season-number parser below need to agree on
// this - the category filter already only checked the prefix, but the
// season-NUMBER extraction used to be anchored with a trailing $,
// meaning it silently failed to recognize an extended name like
// "S118-dr3&4" as season 118 at all. Both now just match the leading
// "s" + digits and ignore whatever follows.

function isRelevantCategory(categoryName) {
    return /^s\d+/i.test(categoryName ?? "");
}

function parseSeasonNumber(categoryName) {
    const match = String(categoryName ?? "").match(/^s(\d+)/i);
    return match ? Number(match[1]) : null;
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

        if (all.length > 5000) {
            console.log("  Hit 5000 message cap.");
            break;
        }
    }

    return all;
}


// =====================================================
// JSON HELPERS
// =====================================================

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
    fs.writeFileSync(
        OUTPUT_PATH,
        JSON.stringify({ decks }, null, 2),
        "utf8"
    );
    console.log("\n✔ decks.json updated");
}


// =====================================================
// CHANNEL KEY
// =====================================================
// Built from a LIVE Discord channel the same way bot.js now STORES the
// channel field (hyphens -> spaces) - if these two didn't match
// exactly the same way, every channel would look "new" forever, since
// the raw hyphenated Discord name would never match a space-replaced
// stored value in decks.json.

function buildChannelKey(seasonName, discordChannelName) {
    return `${seasonName}:${discordChannelName.replace(/-/g, " ")}`;
}


// =====================================================
// CHANNEL PROCESSOR
// =====================================================

let added = 0;
let updated = 0;

async function processChannel(channel, { existingDecks, existingByChannel, existingByMessage, isNewSeason }) {

    const messages = await fetchAllMessages(channel);
    if (!messages.length) {
        console.log("  No messages.");
        return { result: "skip" };
    }

    const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    // Known-season channels: skip entirely if nothing's changed since
    // last run. New-season channels: always process, since by
    // definition nothing in them has been seen before.
    if (!isNewSeason) {
        const unseen = sorted.filter(msg => !existingByMessage.has(msg.id));
        if (unseen.length === 0) {
            console.log("  No new messages — skipping.");
            return { result: "skip" };
        }
    }

    const firstMessage = sorted[0];
    const { deckCode, deckMessage } = findDeckCode(sorted);

    if (!deckCode) {
        console.log("  No deck found. Message previews:");
        sorted.slice(0, 10).forEach((msg, i) => {
            console.log(`    [${i + 1}] ${msg.content.slice(0, 80).replace(/\n/g, " ")}`);
        });
        return { result: "skip" };
    }

    console.log(`  Found deck code (message ${sorted.indexOf(deckMessage) + 1}/${sorted.length})`);

    const record = findRecord(sorted);
    const author = await findAuthor(sorted, firstMessage);
    const notes = findNotes(sorted, deckCode);
    const normalizedCode = normalizeDeckCode(deckCode);

    const channelKey = buildChannelKey(channel.parent?.name, channel.name);

    const deckData = {
        messageId: deckMessage.id,
        season: channel.parent?.name,
        channel: channel.name.replace(/-/g, " "),
        author,
        deckCode: normalizedCode,
        record,
        notes,
        publishedAt: firstMessage.createdAt.toISOString()
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
        if (index !== -1) {
            existingDecks[index] = deckData;
        } else {
            existingDecks.push(deckData);
        }
        existingByChannel.set(channelKey, deckData);
        existingByMessage.add(deckMessage.id);
        updated++;
        console.log("  ✔ Updated");
        return { result: "updated" };
    }

    console.log("  No changes.");
    return { result: "unchanged" };
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

    console.log(`\nScanning "${guild.name}"...`);

    const existingDecks = loadExistingDecks();
    console.log(`Loaded ${existingDecks.length} existing deck(s).`);

    // Lookup maps built from EXISTING decks.json - keys already match
    // the stored (space-replaced) format, since deck.channel is
    // whatever was actually stored there.
    const existingByChannel = new Map();
    const existingByMessage = new Set();

    for (const deck of existingDecks) {
        if (deck.season && deck.channel) {
            existingByChannel.set(`${deck.season}:${deck.channel}`, deck);
        }
        if (deck.messageId) {
            existingByMessage.add(deck.messageId);
        }
    }

    // Determine the latest known season number from existing decks.
    let latestSeason = null;
    if (existingDecks.length > 0) {
        const seasonNumbers = existingDecks
            .map(deck => parseSeasonNumber(deck.season))
            .filter(n => n !== null);
        if (seasonNumbers.length > 0) {
            latestSeason = Math.max(...seasonNumbers);
        }
    }

    console.log(
        latestSeason !== null
            ? `Latest known season: s${latestSeason}`
            : "No previous season detected — scanning all seasons."
    );

    // Bucket every relevant channel by whether its season is ahead of
    // the latest known one (new - always full scan) or exactly equal
    // to it (current - only checked for unseen messages). This
    // naturally covers "the very next season just appeared" as the
    // common case, but also correctly handles more than one new season
    // having appeared since the last run.
    const channels = await guild.channels.fetch();
    const currentSeasonChannels = [];
    const newSeasonChannels = [];

    channels.forEach(channel => {
        if (!channel) return;
        const isText = channel.type === ChannelType.GuildText;
        const seasonNumber = parseSeasonNumber(channel.parent?.name);
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
