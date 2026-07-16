// Doom Reminder - a lighthearted easter egg. Doom is an artifact that
// procs every 12 turns; because of the long wait, players often forget
// it's ticking, hence the community meme of pinging someone "don't
// forget about doom." This recreates that ping as a fake chat message,
// rendered through the game's own real appendMessage(chatMessage,
// idRoom, isPrivate, isNew) function - confirmed via reading its full
// source that it's pure DOM rendering with no socketChat.send anywhere
// in it, so nothing is ever sent over the network; nobody else in chat
// ever sees this.
//
// Deliberately styled as an obviously-fake account rather than trying
// to impersonate a real player - mainGroup.name gets used directly as
// a CSS class on the username span by the real appendMessage function,
// so setting it to "Wizascript" gives us a clean, unique hook to style
// distinctly with our own injected rule, without needing to touch or
// fight the real rendering code at all.
//
// The message pings "@Underscript" specifically - confirmed via live
// testing that this is the one thing that reliably triggers
// UnderScript's own ping audio; pinging the player's own name works
// visually but produces no sound, and pinging BOTH at once breaks
// audio entirely. The player's name is included as plain text instead.

import { getPageWindow } from "../core/page-window.js";

const DOOM_ARTIFACT_NAME = "Doom";

// null = not yet determined this match; true/false once checked once
// against the first available artifact snapshot. Deliberately checked
// ONCE at match load, not continuously - matches "when loading the
// match, check... if not seen, the reminder doesn't come into play."
let doomActive = null;

function injectStyle() {
  if (document.getElementById("wizascript-doom-reminder-style")) return;
  const style = document.createElement("style");
  style.id = "wizascript-doom-reminder-style";
  style.textContent = `
.chat-user.Wizascript {
  color: #ffb400;
  font-weight: bold;
}
`;
  document.head.appendChild(style);
}

function checkForDoomArtifact(event) {
  if (doomActive !== null) return; // already determined this match
  if (event.action !== "getPlayersStats" || !event.artifacts) return;

  try {
    const artifactsByPlayer = JSON.parse(event.artifacts);
    doomActive = Object.values(artifactsByPlayer).some(
      list => Array.isArray(list) && list.some(a => a.name === DOOM_ARTIFACT_NAME)
    );
  } catch (e) {
    // Leave as null - malformed payload, just try again on the next
    // stats event rather than assuming false permanently.
  }
}

function getFirstOpenChatRoomId(win) {
  if (Array.isArray(win.openPublicChats) && win.openPublicChats.length > 0) {
    return win.openPublicChats[0];
  }
  // Fallback if that array is ever empty/unavailable - parse whatever
  // chat tab is currently focused instead.
  const match = String(win.lastChatId || "").match(/(\d+)$/);
  return match ? Number(match[1]) : 1;
}

function sendFakeDoomPing() {
  const win = getPageWindow();
  if (typeof win.appendMessage !== "function") return;

  const idRoom = getFirstOpenChatRoomId(win);

  const fakeMessage = {
    id: `wizascript-doom-${Date.now()}`,
    user: {
      shinyAvatar: false,
      id: 0,
      username: "Wizascript",
      usernameSafe: "wizascript",
      // Astral Assault - confirmed to be a real, existing avatar from
      // live data seen elsewhere in this project. No full avatar list
      // is available to pick from, so reusing a confirmed-real one
      // avoids a broken image icon.
      avatar: { rarity: "MYTHIC", id: 0, name: "Astral Assault", image: "Astral_Assault", ucpCost: 0 },
      profileSkin: { id: 1, name: "Base", image: "Base", ucpCost: 0 },
      frameSkin: { id: 2, name: "Deltarune", image: "Deltarune", ucpCost: 0 },
      division: undefined, // omitted deliberately - chatGetDivisionIcon/chatNormalizeDivision both safely no-op on a falsy division, avoiding a fake rank badge
      groups: [], // empty - avoids an accidental Staff/Contributor/Recruiter icon appearing
      mainGroup: { id: -1, name: "Wizascript", priority: 0 }
    },
    message: `@Underscript don't forget about doom, ${win.selfUsername || "friend"}!`,
    me: false,
    rainbow: false,
    deleted: false,
    idRoom,
    timestamp: Date.now()
  };

  win.appendMessage(fakeMessage, idRoom, false, true);
}

export function resetDoomReminderForMatchStart(turn) {
  if (turn <= 1) {
    doomActive = null;
  }
}

export function registerDoomReminder(plugin, isEnabled) {
  injectStyle();

  plugin.events.on("GameEvent", event => {
    if (!isEnabled()) return;

    checkForDoomArtifact(event);

    if (event.action === "getTurnStart" && doomActive) {
      const numTurn = event.numTurn;
      if (typeof numTurn === "number" && numTurn >= 11 && (numTurn - 11) % 12 === 0) {
        sendFakeDoomPing();
      }
    }
  });
}
