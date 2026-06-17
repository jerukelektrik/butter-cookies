import test from 'node:test';
import assert from 'node:assert/strict';
import { processContentRow } from '../src/uploader.js';

function fakeDependencies(overrides = {}) {
  return {
    fetchDocHtml: () => ({ hasMarker: true, html: '<h1>Judul</h1><p>Isi</p>' }),
    resolveTaxonomy: () => ({ categoryIds: [1, 2], tagIds: [3] }),
    uploadFeaturedImage: () => 10,
    createPost: () => ({ id: 99 }),
    updatePost: () => ({ id: 88 }),
    getPost: () => ({ id: 88, status: 'publish' }),
    buildEditUrl: (_site, id) => `https://example.com/wp-admin/post.php?post=${id}&action=edit`,
    ...overrides,
  };
}

test('processContentRow creates a draft for create_draft', () => {
  const result = processContentRow(
    {
      upload_action: 'create_draft',
      post_title: 'Judul',
      google_doc_url: 'https://docs.google.com/document/d/abc/edit',
      parent_category: 'Bahasa',
      child_category: 'Bahasa SD',
      tags: 'kelas 4',
    },
    { site: { wordpress_base_url: 'https://example.com' }, credentials: { username: 'u', appPassword: 'p' } },
    fakeDependencies()
  );
  assert.equal(result.status, 'uploaded');
  assert.equal(result.wordpress_post_id, 99);
  assert.match(result.wordpress_draft_url, /post=99/);
});

test('processContentRow updates an existing post without sending status', () => {
  let updatePayload;
  const result = processContentRow(
    {
      upload_action: 'update_existing',
      wordpress_post_id: 88,
      post_title: 'Judul',
      google_doc_url: 'https://docs.google.com/document/d/abc/edit',
      parent_category: 'Bahasa',
      child_category: 'Bahasa SD',
      tags: 'kelas 4',
    },
    { site: { wordpress_base_url: 'https://example.com' }, credentials: { username: 'u', appPassword: 'p' } },
    fakeDependencies({
      updatePost: (_id, payload) => {
        updatePayload = payload;
        return { id: 88 };
      },
    })
  );
  assert.equal(result.status, 'updated');
  assert.equal(Object.hasOwn(updatePayload, 'status'), false);
});

test('processContentRow returns error for missing marker', () => {
  const result = processContentRow(
    {
      upload_action: 'create_draft',
      post_title: 'Judul',
      google_doc_url: 'https://docs.google.com/document/d/abc/edit',
      parent_category: 'Bahasa',
      child_category: 'Bahasa SD',
    },
    { site: { wordpress_base_url: 'https://example.com' }, credentials: { username: 'u', appPassword: 'p' } },
    fakeDependencies({ fetchDocHtml: () => ({ hasMarker: false, html: '' }) })
  );
  assert.equal(result.status, 'error');
  assert.match(result.error_notes, /Google Doc marker is missing/);
});
