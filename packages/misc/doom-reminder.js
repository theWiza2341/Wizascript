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

import { getPageWindow } from "../core/page-window.js";
import { getRelevantPlayerId } from "../core/player-context.js";

const DOOM_CYCLE_LENGTH = 12;
const REMINDER_AT_TURN = 11; // one turn before Doom would actually proc, giving a heads-up

let turnsSeenThisMatch = 0;

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

function getCurrentRoomId(win) {
  // window.lastChatId is something like "chat-public-1" - appendMessage
  // itself expects just the numeric part.
  const match = String(win.lastChatId || "").match(/(\d+)$/);
  return match ? Number(match[1]) : 1;
}

function sendFakeDoomPing() {
  const win = getPageWindow();
  if (typeof win.appendMessage !== "function") return;

  const username = win.selfUsername;
  if (!username) return;

  const idRoom = getCurrentRoomId(win);

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
    message: `@${username} don't forget about doom`,
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
    turnsSeenThisMatch = 0;
  }
}

export function registerDoomReminder(plugin, isEnabled) {
  injectStyle();

  plugin.events.on("GameEvent", event => {
    if (!isEnabled()) return;

    const relevantId = getRelevantPlayerId();
    if (relevantId === null) return;

    if (event.action === "getTurnStart" && event.idPlayer === relevantId) {
      turnsSeenThisMatch++;
      if (turnsSeenThisMatch % DOOM_CYCLE_LENGTH === REMINDER_AT_TURN) {
        sendFakeDoomPing();
      }
    }
  });
}
