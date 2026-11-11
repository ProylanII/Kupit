// Shared bits for the headless-Chrome QA scripts (tools/qa/*.mjs). Needs `npm i` (puppeteer-core, dev only)
// and a Chrome or Edge on the machine; nothing is downloaded. See docs/QA.md.
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch() {
  const executablePath = CANDIDATES.find((p) => p && existsSync(p));
  if (!executablePath) throw new Error('no Chrome/Edge found; set CHROME=<path to the browser executable>');
  return puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
}

// A page that records console errors, page errors and failed requests into `errors`.
export async function openPage(browser, { phone = true } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  if (phone) await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  else await page.setViewport({ width: 1280, height: 800 });
  return { page, errors };
}

export const state = (page) => page.evaluate(() => {
  const k = window.__kupit;
  if (!k) return { mode: 'NO GAME' };
  const w = k.play?.world;
  return { mode: k.mode, level: k.cur?.id, status: w?.status, coins: w?.coins, time: w && +w.time.toFixed(1), lives: w?.livesLeft, loadError: k.loadError };
});
