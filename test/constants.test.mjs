import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTENT_MARKER,
  CONTENT_HEADERS,
  META_LIMITS,
  UPLOAD_ACTIONS,
  EDITORIAL_STATUSES,
  ARTICLE_TYPES,
} from '../src/constants.js';

test('content marker is explicit and stable', () => {
  assert.equal(CONTENT_MARKER, '=== START WORDPRESS CONTENT ===');
});

test('content headers include operational and WordPress result columns', () => {
  assert.ok(CONTENT_HEADERS.includes('upload_action'));
  assert.ok(CONTENT_HEADERS.includes('google_doc_url'));
  assert.ok(CONTENT_HEADERS.includes('wordpress_post_id'));
  assert.ok(CONTENT_HEADERS.includes('last_processed_at'));
});

test('allowed workflow enums match the design spec', () => {
  assert.deepEqual(UPLOAD_ACTIONS, ['create_draft', 'update_existing', 'skip']);
  assert.deepEqual(EDITORIAL_STATUSES, ['publish', 'schedule', 'drafted', 'update']);
  assert.deepEqual(ARTICLE_TYPES, ['new article', 'rework', 'LHF', 'Low CTR', 'Lost Keywords']);
});

test('SEO meta limits match the approved ranges', () => {
  assert.deepEqual(META_LIMITS.title, { min: 55, max: 62 });
  assert.deepEqual(META_LIMITS.description, { min: 155, max: 162 });
});
