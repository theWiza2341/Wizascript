# Wizascript Card Gallery data

This branch holds the Card Gallery's approved posts. Wizascript reads it; the gallery's Cloudflare Worker (wizascript-gallery-worker) writes it.

- `posts/<id>.json`: one approved post (a single card or a set), with its author (their Undercards name) and cards.
- `art/<id>-<n>.png`: the art for card `n` of post `<id>`.
- `index.json`: every approved post, newest first. The Worker rewrites it after each decision.

**How posts arrive:** the Worker opens one pull request per upload into this branch.
- **Approve:** merge the pull request.
- **Reject:** close it (a comment can say why).

Within 15 minutes the Worker updates the post's status for its author, rewrites index.json and deletes the gallery-post/... branch.

**To take an approved post down:** use the Worker's admin "remove" request (see its README). It disappears from index.json; its files can stay.
