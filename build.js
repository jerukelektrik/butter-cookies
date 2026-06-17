import esbuild from 'esbuild';
import fs from 'fs';

async function build() {
  const distDir = './dist';
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  console.log('Bundling project using esbuild...');
  await esbuild.build({
    entryPoints: ['src/Code.js'],
    bundle: true,
    outfile: 'dist/Code.js',
    platform: 'browser',
    format: 'iife',
    globalName: 'UploaderBundle',
  });

  console.log('Appending Apps Script top-level entrypoints...');
  const entrypoints = `
// Top-level Apps Script entrypoints mapping to globalThis properties
function onOpen() {
  if (typeof globalThis !== 'undefined' && globalThis.onOpen) {
    globalThis.onOpen();
  }
}
function setupTemplate() {
  if (typeof globalThis !== 'undefined' && globalThis.setupTemplate) {
    globalThis.setupTemplate();
  }
}
function validatePreviewCurrentSite() {
  if (typeof globalThis !== 'undefined' && globalThis.validatePreviewCurrentSite) {
    globalThis.validatePreviewCurrentSite();
  }
}
function validatePreviewAllSites() {
  if (typeof globalThis !== 'undefined' && globalThis.validatePreviewAllSites) {
    globalThis.validatePreviewAllSites();
  }
}
function uploadCurrentSite() {
  if (typeof globalThis !== 'undefined' && globalThis.uploadCurrentSite) {
    globalThis.uploadCurrentSite();
  }
}
function uploadAllSites() {
  if (typeof globalThis !== 'undefined' && globalThis.uploadAllSites) {
    globalThis.uploadAllSites();
  }
}
`;

  fs.appendFileSync('dist/Code.js', entrypoints);
  console.log('Build complete! File generated at dist/Code.js');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
