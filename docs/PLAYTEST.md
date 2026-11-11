# Silent playtest

Levels 1–3 now teach one idea each, and one-time tips explain everything else the first time it comes up. Only
people who have never seen the game can tell you whether that works.

1. **Who**: 3–5 people who have never played Kupit. Use phones if that's where the game will live.
2. **Setup**: open the game with `?playtest=1` on a clean browser profile (or clear site data), so the tips and the
   intro story show up. Screen-record for five minutes per person. Turn on the camera too, if they agree.
3. **Say nothing.** No hints and no "try the button". If they ask, answer: "What do you think it does?"
4. **Mark** in the recording every:
   - pause longer than about 3 seconds, or a hunt for a button (the log also records `idle` after 6 s still),
   - death, and what they think caught them,
   - puzzled look, sigh, or "oh!".
5. **Collect the log**: Options → COPY PLAYTEST LOG (it only appears in playtest mode). It is a JSON list of
   `start`, `pause`, `idle`, `spotted`, `caught` (with `final` on the last one), `respawn`, `checkpoint`, `phase`,
   `alkansya` and `clear` events, each with the level, time, tile and who was involved. It never leaves the device.
6. **Fix** the marks that repeat across people first. Each one is a tutorial gap: a missing tip, a level that teaches
   two things at once, or a rule the screen doesn't show.

What the first three levels are supposed to teach:

| Level | Teaches | Should be obvious without words |
|---|---|---|
| 1 Sala | move, kupit (hold), exit | One slow Mama with a visible cone. The purse shows a hand on the button. |
| 2 Kusina | hide, throw | A box right where you get seen first. A tsinelas next to the spawn. |
| 3 Buong Bahay | doors, keys, levers | The locked door shows the key colour. A lever next to a closed gate. |
