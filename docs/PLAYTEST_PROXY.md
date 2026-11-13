# Phase 0 baseline: automated playtest proxy

Date: 2026-11-13. Build: `design-overhaul` after Phase 1 (`c8b3b99`). Tool: `node tools/playtest-proxy.mjs`.

**This replaces the timing half of the human playtest, not the rest of it.** A bot cannot say whether a level is fun,
fair, readable or confusing, and it plays the shortest route with perfect inputs. It *can* measure route length,
whether stealth is needed at all, whether running beats sneaking, and how much slack the timers leave.

## The three bots

| Bot | What it does | What it tells us |
|---|---|---|
| **expert** | Can't be caught, sneaks the shortest route | The fastest possible clear. A first-time human is slower: assume about 2–3× (an assumption, not a measurement) |
| **blind** | Ignores every adult, sneaks, can be caught (3 chances) | If it clears, the level never forces any stealth |
| **run** | The blind bot, running everywhere | If it clears while the blind bot fails, running's noise is not worth avoiding |

## Results

| Level | Expert (s) | Par (s) | Par ÷ expert | Dinner ÷ expert | Escape used / given | Blind | Run | Flag |
|---|---|---|---|---|---|---|---|---|
| 01-sala | 22.3 | 60 | 2.7 | | | clear, 0 close calls | clear 12.4 s | **No stealth needed** |
| 02-kusina | 28.0 | 80 | 2.9 | | | clear, **never seen** | clear, 2 close | **No stealth needed** |
| 03-buong-bahay | 20.6 | 110 | **5.3** | | | clear, 2 close | fail | **No stealth needed** |
| boss1-lola | 32.4 | 90 | 2.8 | | 10.7 / 25 | fail | fail | |
| 04-bakuran | 31.2 | 120 | 3.8 | | | fail | fail | |
| 06-kwarto | 57.3 | 150 | 2.6 | | | fail | clear, 0 close | **Running beats sneaking** |
| gatas | 45.2 | 140 | 3.1 | | | fail | fail | |
| boss2-mama | 33.8 | 110 | 3.3 | | 10.4 / 22 | fail | fail | |
| 05-gabi | 42.7 | 120 | 2.8 | 3.7 | | fail | fail | |
| 07-sampayan | 44.1 | 160 | 3.6 | | | clear, 1 close | fail | **No stealth needed** |
| ibalik | 46.9 | 150 | 3.2 | | | fail | fail | |
| boss3-tatay | 38.6 | 120 | 3.1 | | 12.9 / 25 | fail | fail | |
| 08-palengke | 43.7 | 190 | 4.3 | | | fail | clear, 2 close | **Running beats sneaking** |
| boss4-fiesta | 29.5 | 120 | 4.1 | | 7.6 / 25 | fail | fail | |
| 09-barangay | 55.6 | 230 | 4.1 | | | fail | fail | |
| bagyo | 44.1 | 150 | 3.4 | | 12.0 / 45 | fail | fail | |

(HINGI, the epilogue, has no threats and is skipped.)

## What it means

1. **Four levels can be beaten without stealth:** SALA, KUSINA, BUONG BAHAY and SAMPAYAN.
   - SALA is the tutorial, so that's acceptable there.
   - KUSINA is the clearest problem: the shortest route never enters a single cone.
   - Feeds: audit L1-a, L2-b, L3-a, and the SAMPAYAN tag-team rebuild (Blueprint L10).
2. **In the two biggest maps, running everywhere is better than sneaking.**
   - KWARTO and PALENGKE: the run bot clears them, the sneaking blind bot doesn't. Speed outruns detection, so
     running's noise costs nothing.
   - Feeds: Blueprint 7.0 rules and Phase 4 tuning. Consider a stronger run noise or faster-filling alert on large
     maps.
3. **Escape timers leave 1.9–3.7× the expert's time:**

   | Boss | Expert used / timer gives | Slack |
   |---|---|---|
   | Lola | 10.7 / 25 s | 2.3× |
   | Mama | 10.4 / 22 s | 2.1× |
   | Tatay | 12.9 / 25 s | 1.9× |
   | Party | 7.6 / 25 s | 3.3× |
   | Storm | 12.0 / 45 s | 3.7× |

   - At an assumed 2–3× human factor, Tatay and Mama may be tight; the party and the storm are walks.
   - Confirms audit E3; most of these timers are replaced by the unique finales (Blueprint 8).
4. **Par is 2.6–5.3× the expert's time.**
   - BUONG BAHAY (5.3×), PALENGKE (4.3×), the party (4.1×) and BARANGAY (4.1×) are likely easy "fast" stars.
   - Set pars only after the level pass. Suggested rule until humans are measured: par = 2.2× expert.
5. **KAIN NA in GABI gives 3.7× the expert's time.** It probably never triggers for a competent player.
   Suggested: 2.2× expert plus the warning call (Blueprint L9).

## Still needs people

- Fun, fairness, readability, confusion points, the emotional ending.
- Real human speed, to replace the assumed 2–3× factor.
- Run the human playtest (`docs/PLAYTEST.md`) before release, Phase 8. The proxy is re-run after every phase.
