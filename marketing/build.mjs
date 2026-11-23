// Builds the landing page for GitHub Pages: wraps marketing/site/index.html (written as a page
// body, the way the Claude Artifact host expects it) in a full HTML document and copies only the
// files the page references into marketing/dist.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, 'site');
const dist = join(here, 'dist');

const body = readFileSync(join(site, 'index.html'), 'utf8');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
  :root { color-scheme: light; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
  body { margin: 0; font: 14px system-ui, sans-serif; }
  img { max-width: 100%; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
${body}
</body>
</html>
`;

// Every same-origin file the page loads.
const refs = new Set([...body.matchAll(/(?:src|poster|href)="((?!https?:|#|mailto:)[^"]+)"/g)].map((m) => m[1]));
for (const extra of ['app-light.png', 'app-dark.png']) refs.add(extra); // loaded by glass-demo.js

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, 'index.html'), html);
for (const ref of refs) {
  mkdirSync(dirname(join(dist, ref)), { recursive: true });
  cpSync(join(site, ref), join(dist, ref));
}
writeFileSync(join(dist, '.nojekyll'), '');
console.log(`marketing/dist: index.html + ${refs.size} files`);
