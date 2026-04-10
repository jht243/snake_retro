#!/usr/bin/env node
/**
 * Inline the compiled JS bundle into the HTML template using base64 encoding
 * to avoid HTML parser issues with large bundles.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const htmlPath = path.join(__dirname, '../assets/snake-game.html');
const jsPath = path.join(__dirname, '../assets/snake-game.js');

console.log('[Inline Bundle] Reading files...');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
const jsContent = fs.readFileSync(jsPath, 'utf-8');

console.log(`[Inline Bundle] JS bundle size: ${(jsContent.length / 1024).toFixed(2)} KB`);

const encodedJS = Buffer.from(jsContent, 'utf-8').toString('base64');
console.log(`[Inline Bundle] Encoded size: ${(encodedJS.length / 1024).toFixed(2)} KB`);

const inlineScript = `<script type="module">
  const encodedScript = ${JSON.stringify(encodedJS)};
  const decodedScript = atob(encodedScript);
  const blob = new Blob([decodedScript], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  import(url)
    .catch(err => {
      console.error('[Snake Game] Failed to load:', err);
      const root = document.getElementById('snake-game-root');
      if (root) {
        root.innerHTML = '<div style="padding:24px;text-align:center;color:#f87171;">Failed to load game. Please refresh.</div>';
      }
    });
</script>
</body>`;

const updatedHtml = htmlContent.replace(
  /<script[^>]*>[\s\S]*?<\/script>\s*<\/body>/,
  inlineScript
);

if (updatedHtml === htmlContent) {
  console.error('[Inline Bundle] ERROR: Script tag not found or not replaced!');
  process.exit(1);
}

fs.writeFileSync(htmlPath, updatedHtml, 'utf-8');
console.log('[Inline Bundle] Successfully inlined encoded bundle into HTML');
console.log(`[Inline Bundle] Output: ${htmlPath}`);
