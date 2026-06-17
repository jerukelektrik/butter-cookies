import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHeaderMap,
  mapRowToObject,
  buildMetaLengthFormula,
  buildMetaCheckFormula,
  buildUploadLogRow,
  normalizeBoolean,
} from '../src/sheets.js';

test('buildHeaderMap maps headers to zero-based indexes', () => {
  assert.deepEqual(buildHeaderMap(['site_key', 'active']), { site_key: 0, active: 1 });
});

test('mapRowToObject trims string values and keeps numbers', () => {
  const result = mapRowToObject(['post_title', 'wordpress_post_id'], [' Judul ', 123]);
  assert.deepEqual(result, { post_title: 'Judul', wordpress_post_id: 123 });
});

test('normalizeBoolean handles sheet-like truthy values', () => {
  assert.equal(normalizeBoolean(true), true);
  assert.equal(normalizeBoolean('TRUE'), true);
  assert.equal(normalizeBoolean('yes'), true);
  assert.equal(normalizeBoolean('1'), true);
  assert.equal(normalizeBoolean('FALSE'), false);
});

test('buildMetaLengthFormula counts a source cell', () => {
  assert.equal(buildMetaLengthFormula('M2'), '=LEN(M2)');
});

test('buildMetaCheckFormula creates title warning formula', () => {
  assert.equal(
    buildMetaCheckFormula('N2', 'title'),
    '=IF(N2="","",IF(N2<55,"meta title too short",IF(N2>62,"meta title too long","")))'
  );
});

test('buildMetaCheckFormula creates description warning formula', () => {
  assert.equal(
    buildMetaCheckFormula('Q2', 'description'),
    '=IF(Q2="","",IF(Q2<155,"meta description too short",IF(Q2>162,"meta description too long","")))'
  );
});

test('buildUploadLogRow maps entries to upload log header order', () => {
  assert.deepEqual(
    buildUploadLogRow(['timestamp', 'run_id', 'result', 'message'], {
      timestamp: '2026-06-17T00:00:00Z',
      run_id: 'run-1',
      result: 'uploaded',
    }),
    ['2026-06-17T00:00:00Z', 'run-1', 'uploaded', '']
  );
});
