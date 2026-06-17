import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(rootDir, 'apps-script');

const sourceFiles = [
  'src/constants.js',
  'src/sheets.js',
  'src/auth.js',
  'src/validation.js',
  'src/docs.js',
  'src/wordpress.js',
  'src/uploader.js',
  'src/Code.js',
];

function toAppsScript(source) {
  return source
    .replace(/import\s+\{[\s\S]*?\}\s+from\s+['"][^'"]+['"];?\n?/g, '')
    .replace(/export\s+class\s+/g, 'class ')
    .replace(/export\s+function\s+/g, 'function ')
    .replace(/export\s+const\s+/g, 'const ')
    .trim();
}

const banner = `/**
 * Butter Cookies - WordPress Content Plan Uploader
 *
 * Generated from src/*.js by scripts/build-gas.mjs.
 * INSTALL: Extensions > Apps Script > paste this Code.gs > Save > Reload sheet.
 */
`;

mkdirSync(outputDir, { recursive: true });

const bundled = sourceFiles
  .map((file) => {
    const source = readFileSync(join(rootDir, file), 'utf8');
    return `\n// --- ${file} ---\n${toAppsScript(source)}\n`;
  })
  .join('\n');

writeFileSync(join(outputDir, 'Code.gs'), `${banner}${bundled}`, 'utf8');
writeFileSync(join(outputDir, 'appsscript.json'), readFileSync(join(rootDir, 'appsscript.json'), 'utf8'), 'utf8');

console.log('Generated apps-script/Code.gs and apps-script/appsscript.json');
