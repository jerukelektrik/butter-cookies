import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContentRow, splitTags, metaWarnings } from '../src/validation.js';

const baseContext = {
  site: { site_key: 'ruangguru', wordpress_base_url: 'https://example.com', active: 'TRUE' },
  credentials: { username: 'admin', appPassword: 'secret' },
  docHasMarker: true,
};

test('splitTags trims comma-separated tags', () => {
  assert.deepEqual(splitTags('kelas 12, konsep pelajaran, sma'), ['kelas 12', 'konsep pelajaran', 'sma']);
});

test('metaWarnings returns non-blocking SEO messages', () => {
  assert.deepEqual(metaWarnings({ meta_title: 'Pendek', meta_description: 'Singkat' }), [
    'meta title too short',
    'meta description too short',
  ]);
});

test('validateContentRow skips skip action', () => {
  const result = validateContentRow({ upload_action: 'skip' }, baseContext);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, ['row skipped by upload_action']);
  assert.equal(result.shouldProcess, false);
});

test('create_draft requires title, doc, marker, and categories', () => {
  const result = validateContentRow({ upload_action: 'create_draft' }, { ...baseContext, docHasMarker: false });
  assert.deepEqual(result.errors, [
    'post_title is required for create_draft',
    'google_doc_url is required',
    'Google Doc marker is missing',
    'parent_category is required',
    'child_category is required',
  ]);
});

test('update_existing requires wordpress_post_id', () => {
  const result = validateContentRow(
    {
      upload_action: 'update_existing',
      post_title: 'Judul',
      google_doc_url: 'https://docs.google.com/document/d/abc/edit',
      parent_category: 'Bahasa Indonesia',
      child_category: 'Bahasa Indonesia SMP',
    },
    baseContext
  );
  assert.deepEqual(result.errors, ['wordpress_post_id is required for update_existing']);
});

test('valid create_draft can process with SEO warnings', () => {
  const result = validateContentRow(
    {
      upload_action: 'create_draft',
      post_title: 'Judul',
      google_doc_url: 'https://docs.google.com/document/d/abc/edit',
      parent_category: 'Bahasa Indonesia',
      child_category: 'Bahasa Indonesia SMP',
      meta_title: 'Judul',
      meta_description: 'Deskripsi pendek',
    },
    baseContext
  );
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.includes('meta title too short'));
  assert.ok(result.warnings.includes('meta description too short'));
  assert.equal(result.shouldProcess, true);
});
