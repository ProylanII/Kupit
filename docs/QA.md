# QA

Three layers, cheapest first. All of them are green at the time of writing (see STATUS.md).

## 1. `npm test` (no dependencies, about 20 s)

`node --test tests/*.test.mjs`: level validator, Random/Daily House generation, AI, sound, save migration,
economy, art lock, soak runs and the **walkthrough bot** (`tests/bot.mjs`), which plays every level, 40 generated
houses, every mutator and the next two weeks of Daily Houses with real inputs and must finish.

## 2. `npm run qa` (headless Chrome, needs `npm i` once and a Chrome or Edge on the machine)

Start the game first (`npm start`, note the port it prints) and pass that URL if it is not 8080:

```
node tools/qa/smoke.mjs http://localhost:8080   # every screen + every level on a phone and a desktop viewport,
                                                # pause/resume, dev hotkeys, the load-failure screen; screenshots in tools/qa/out
node tools/qa/pwa.mjs http://localhost:8080     # service worker caches the whole version, navigation through it,
                                                # OFFLINE boot + level + Daily House, manifest/icons installable
```

`?sw=1` is what makes the service worker run on localhost (it is skipped there otherwise so edits show up).
Nothing is downloaded: `puppeteer-core` drives the browser already installed (`CHROME=<path>` to point at one).

## 3. By hand (the things a bot cannot judge)

Play-through checklist, desktop (keyboard) and phone (touch), per level:

| # | Level | What to look for |
|---|---|---|
| 1 | Sala | Coach lines make sense in order; purse click wakes nothing; exit opens at 3 coins |
| 2 | Kusina | Box hides from Mama; thrown tsinelas pulls her; Lola's sweep is readable; lego ARAY |
| 3 | Buong Bahay | Locked door shows the key colour; lever opens the gate; doors cut Tita's cone |
| 4 | Lola's Siesta | Sleep bar drains on noise; phase 2 Mama checks boxes; finale: any noise = chase; escape in 25 s |
| 5 | Bakuran | Timed gate from both sides; pandesal keeps Aso busy (eat pose); Tatay on the far side |
| 6 | Kwarto | Blue key opens both locks; TV lure; Kuya's tattle wind-up ring |
| 7 | Mama sa Kusina | Sandok is dodgeable sideways; stirring pose; phase 3 hunt |
| 8 | Gabi | Night pools; KAIN NA bar; dinner at 160 s ends the level |
| 9 | Sampayan | Curtains as cover; 10 s gate; sleeping dog |
| 10 | Tatay + Aso | Dog barks (mouth open), Tatay follows; pandesal splits them; scent trail |
| 11 | Palengke | Tinderas shout but stay; scrolling + threat arrows + objective marker |
| 12 | Ninang's Fiesta | Guests block cones (cone clipped); more ninangs spawn blind for a moment |
| 13 | Barangay Hall | Tanod sweep + whistle; tricycle knocks you down; two keys |
| 14 | Sari-Sari Store | Candy in the storeroom; shutter closes in phase 3, lever reopens; ending story once |

Plus: Random House at difficulty 1 and 5, each mutator, the Daily House twice in one day (second run pays only
new stars), COPY RESULT, store purchase + stat bar, each kid's skill and pose, outfits in the store and on the
title, options (shake off, flash off, left-handed, ghost off), pause by backgrounding the tab, `?dev=1` menu,
install from the browser menu and launch from the home screen, then airplane mode.

What to report: the level, what you expected, what happened, and the share card / playtest log
(`?playtest=1`, Options → COPY PLAYTEST LOG) if you have it.
