# Record of processing (GDPR art. 30)

Last updated: 2026-11-14 (Wizascript 1.8.0, server 1.10.0). Kept with the code so it changes with it. The public notice is [PRIVACY.md](PRIVACY.md).

**Controller:** the Wizascript maintainer, an individual hobby project (contact in PRIVACY.md). No employees. No EU establishment.

**Systems:** the Wizascript userscript; the Wizascript server (Cloudflare Worker + D1 database, `wizascript-gallery-worker`, private repo); the public `gallery` branch of `theWiza2341/Wizascript` on GitHub; the gallery website (GitHub Pages, no server-side code).

## Processing activities

### 1. Account linking

| | |
|---|---|
| Purpose | Tie a Wizascript install to an Undercards account, for the Card Gallery and Usage Statistics |
| People | Players who press Link |
| Data | Undercards name and numeric id; install id, secret hash, link times; which accounts linked on one install (voter groups); one-time link and device codes (hashed); a gallery key carried by a device code (AES-GCM, key derived from the code, which isn't stored) |
| Source | The player (the void line they send; their page's `selfId` / `selfUsername`) |
| Basis | Legitimate interest (6(1)(f)): providing the features the player asks for, and preventing one person voting as many |
| Recipients | Cloudflare (host); Discord (reading the void relay channel; nothing kept) |
| Retention | While linked. Device codes: deleted a day after expiry; carried key cleared on use or expiry. Voter-group rows: until removed on request (`/v1/admin/forget`) |
| Tables | `installs`, `install_accounts`, `accounts`, `link_shares` |

### 2. Card Gallery: posts, votes, review

| | |
|---|---|
| Purpose | A public gallery of fan-made cards: uploads, staff review, votes, contests |
| People | Players who post or vote; staff (owner, reviewers, judges) |
| Data | Post content and author name; status, decision, rejection reason; votes (voter group, account, value); staff names in the review log; judge scores |
| Basis | Legitimate interest: the gallery the player chooses to post to; staff accountability |
| Recipients | Cloudflare; **GitHub (public)**: approved posts with author name, and commit messages naming the author. Git history keeps earlier versions |
| Retention | Approved: until the author deletes it or staff remove it. Rejected: pictures 30 days (`REJECT_KEEP`), text kept for review context. Deleted: text only, staff-visible. Review log: newest 1000 entries (`KEEP_LOG`). Votes: while the post exists |
| Tables | `posts`, `votes`, `review_log`, `reviewers`, `scores`, `contests` |

### 3. Post notes

| | |
|---|---|
| Purpose | Text conversations between staff and a post's author (including rejection reasons) |
| Data | Messages (≤500 characters, no links), who wrote them, times |
| Basis | Legitimate interest |
| Retention | Messages deleted 12 months after the note closes (`KEEP_NOTES`); the note's log line (post, title, who, when) stays |
| Tables | `threads`, `thread_msgs` |

### 4. Usage Statistics (opt-in)

| | |
|---|---|
| Purpose | Published card/artifact/soul usage statistics; the player's own Profile and History extras |
| People | Players who turn it on and confirm (opponents: see the balancing test below) |
| Data | Per PvP game: soul, result, division and Elo before/after, ranked flag, the opponent's **soul** (not name), starting deck and artifacts, time; the player name and id it was played on (alts) |
| Source | The player's own browser: the game's end message and the player's saved deck |
| Basis | **Consent** (6(1)(a)): the opt-in prompt; withdrawn by turning it off or Delete My Data |
| Not collected | The opponent's name (kept only on the recording device, for History); anything about the opponent's cards; anything during play |
| Retention | Decks: 8 days after the month ends (the month's statistics are rebuilt from them until then). Opponent's soul: until the month ends. Rows: 12 months after the account's last game (`KEEP_IDLE`), or 30 days after no device is linked (`KEEP_UNLINKED`). Published files: anonymous aggregates, kept |
| Anonymity of output | Aggregates only; Today's ranked divisions are grouped to ≥3 players and drop rows from <3 players; Total and True Hub+ leave out those cells (no working out by subtraction) |
| Tables | `games`, `stats_files` |

### 5. Abuse limits

| | |
|---|---|
| Purpose | Rate limiting |
| Data | The first 24 hex characters of SHA-256("wz-ip:" + IP), or an install/account id, with a counter |
| Basis | Legitimate interest (security) |
| Retention | 2 days |
| Tables | `rate` |

## Legitimate interest: balancing test (usage statistics' opponents, and the gallery)

1. **Interest.** A community tool for a free card game: a gallery players post to on purpose, and statistics on which cards are played. Lawful, clearly stated, real and present.
2. **Necessity.** The gallery needs the author's name (credit, review, abuse) and votes per voter group (one person, one vote). Usage Statistics does **not** need opponents' names, so since 1.8.0 they're never sent; the opponent's soul is kept only for the player's own History during the month.
3. **Balance.** The data is low-sensitivity (game names, game results, fan cards), much of it already public on Undercards. Players expect a gallery to show their name on what they post. Opponents are not identifiable from what the server keeps. Safeguards: opt-in for statistics, aggregates with a 3-player minimum, retention limits, Download/Delete in the plugin, deletion on request, no selling or ads. Players under 15 are asked to involve a parent.

Conclusion: the interests aren't overridden, given these safeguards.

## Requests

- Access / portability: the player's Download My Data (`GET /v1/me/export`), or on request.
- Erasure: Delete My Data (games), Browse → Delete (posts), or on request with `POST /v1/admin/forget { account }` (owner key). That deletes games, votes, notes, device links and non-public posts, and lists approved and pending posts to remove by hand. Removing a post from the gallery branch's **git history** needs a history rewrite of that branch.
- Answer within one month (art. 12(3)).

## Security

HTTPS only; install secrets and gallery keys stored as SHA-256 hashes; device-code key carry encrypted; secrets (GitHub, Discord, admin) only in the Worker's environment; the private server repo; no third-party analytics.

## Known gaps / decisions

- **EU representative (art. 27):** not appointed. A free hobby project with no EU establishment; noted as a known gap, reviewed if the project grows.
- **Age:** no age check; the opt-in prompt and notice ask under-15s to involve a parent.
