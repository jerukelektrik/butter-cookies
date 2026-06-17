import test from 'node:test';
import assert from 'node:assert/strict';
import { extractGoogleDocId, sliceAfterMarker, cleanExportedHtml } from '../src/docs.js';

test('extractGoogleDocId handles standard Google Docs URLs', () => {
  assert.equal(
    extractGoogleDocId('https://docs.google.com/document/d/abc123DEF456/edit'),
    'abc123DEF456'
  );
});

test('extractGoogleDocId handles raw document IDs', () => {
  assert.equal(extractGoogleDocId('abc123DEF456'), 'abc123DEF456');
});

test('sliceAfterMarker returns content after marker only', () => {
  const html = '<p>Brief</p><p>=== START WORDPRESS CONTENT ===</p><h1>Judul</h1><p>Isi</p>';
  assert.equal(sliceAfterMarker(html).html, '<h1>Judul</h1><p>Isi</p>');
  assert.equal(sliceAfterMarker(html).hasMarker, true);
});

test('sliceAfterMarker reports missing marker', () => {
  const result = sliceAfterMarker('<h1>Judul</h1>');
  assert.equal(result.html, '');
  assert.equal(result.hasMarker, false);
});

test('cleanExportedHtml removes scripts, styles, and Google wrapper noise', () => {
  const dirty =
    '<html><head><style>.x{}</style><script>x()</script></head><body><h1 class="c1">Judul</h1><p>Isi</p></body></html>';
  assert.equal(cleanExportedHtml(dirty), '<h1>Judul</h1><p>Isi</p>');
});
