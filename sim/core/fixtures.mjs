import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIM_ROOT = join(__dirname, '..');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf-8'));

export function loadFixtures(platform) {
  return {
    urls: readJson(join(SIM_ROOT, 'fixtures', 'urls.json')),
    errors: readJson(join(SIM_ROOT, 'fixtures', 'error-messages.json')),
    systemInfo: readJson(join(SIM_ROOT, platform, 'fixtures', 'system-info.json')),
  };
}

export function loadScenario(platform, name) {
  return readJson(join(SIM_ROOT, platform, 'scenarios', `${name}.json`));
}

export const jitter = (ms, pct = 0.2) => {
  const delta = ms * pct;
  return Math.max(50, Math.round(ms + (Math.random() * 2 - 1) * delta));
};

export const randRange = ([min, max]) =>
  Math.round(min + Math.random() * (max - min));

export function pickWeighted(items) {
  const total = items.reduce((s, it) => s + (it.weight ?? 1), 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight ?? 1;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

export function pickStatusCode(statusMix) {
  const entries = Object.entries(statusMix);
  let roll = Math.random();
  for (const [code, prob] of entries) {
    roll -= prob;
    if (roll <= 0) return Number.parseInt(code, 10);
  }
  return Number.parseInt(entries[entries.length - 1][0], 10);
}

export const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
