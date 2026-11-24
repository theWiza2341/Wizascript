// packages/usage-stats/nudge.js
//
// 1.8.3: a small reminder for players who HAVEN'T opted in. Every 20th PvP game
// (counted on this device only, never sent), after the match ends, a toast says
// what Usage Statistics would show, how many players share already, and offers a
// Preview (sample data) or "Don't ask again". Nothing runs once that's chosen,
// once the plugin is on, or outside matches.

import { toastClick } from "../core/toast.js";
import { matchesPage } from "../core/page-match.js";
import { getStats } from "./api.js";
import { log } from "./common.js";

const COUNT_KEY = "wizascript.usageStats.nudgeCount";
const OFF_KEY = "wizascript.usageStats.nudgeOff";
export const NUDGE_EVERY = 20;

const get = (k, d) => { try { return GM_getValue(k, d); } catch (e) { return d; } };
const set = (k, v) => { try { GM_setValue(k, v); } catch (e) { /* no GM */ } };

export function startNudge(plugin, { openPreview }) {
if (get(OFF_KEY, false) || !matchesPage("/Game")) return;
  const onEnd = (data) => {
if (!data || data.gameType !== "RANKED" || get(OFF_KEY, false)) return;
    const n = Number(get(COUNT_KEY, 0)) + 1;
    set(COUNT_KEY, n);
    if (n % NUDGE_EVERY) return;
    log(`nudge after ${n} PvP games`);
    const show = (players) => {
      try {
        plugin.toast({
          title: "Usage Statistics",
          text: `You've played ${n} PvP games with Wizascript. Turn on <b>Usage Statistics</b> (opt-in, in the Plugins list) to see your deck records, matchups and win rates${players ? `, built with ${players} players this month` : ""}.`,
          className: "dismissable",
          buttons: [
            { text: "Preview", className: "dismiss", ...toastClick(() => openPreview()) },
            { text: "Don't ask again", className: "dismiss", ...toastClick(() => set(OFF_KEY, true)) }
          ]
        });
      } catch (e) { log("nudge toast failed:", e); }
    };
    // The public statistics say how many players share (no account needed); never wait long for it.
    let done = false;
    const once = (p) => { if (!done) { done = true; show(p); } };
    getStats("SEASON").then((f) => once(f && f.sel && f.sel.TOTAL ? f.sel.TOTAL.players : 0), () => once(0));
    setTimeout(() => once(0), 4000);
  };
  plugin.events.on("getVictory", onEnd);
  plugin.events.on("getDefeat", onEnd);
}
