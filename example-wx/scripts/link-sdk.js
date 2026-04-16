#!/usr/bin/env node
// Copy the linked SDK's built output into miniprogram_npm/ so WeChat
// Developer Tools picks it up without relying on its "Build npm" action,
// which silently skips local file: dependencies.
//
// Runs automatically after `npm install` in example/ via the postinstall
// script in package.json.
const fs = require('node:fs');
const path = require('node:path');

const srcDir = path.resolve(__dirname, '..', 'node_modules', 'mini-program-monitor', 'dist');
const destDir = path.resolve(__dirname, '..', 'miniprogram_npm', 'mini-program-monitor');

if (!fs.existsSync(srcDir)) {
  console.error(
    '[example] node_modules/mini-program-monitor/dist is missing. ' +
      'Run `npm run build` in the repo root first, then `npm install` here.',
  );
  process.exit(1);
}

fs.rmSync(destDir, { recursive: true, force: true });
fs.mkdirSync(destDir, { recursive: true });
for (const entry of fs.readdirSync(srcDir)) {
  fs.cpSync(path.join(srcDir, entry), path.join(destDir, entry), { recursive: true });
}
console.log(`[example] linked ${srcDir} → ${destDir}`);
