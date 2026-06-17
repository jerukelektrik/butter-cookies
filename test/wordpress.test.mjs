import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WordPressClient,
  buildBasicAuthHeader,
  buildEditUrl,
  buildPostPayload,
  normalizeBaseUrl,
} from '../src/wordpress.js';

test('buildBasicAuthHeader creates Basic auth header', () => {
  assert.equal(buildBasicAuthHeader('admin', 'app pass'), `Basic ${Buffer.from('admin:app pass').toString('base64')}`);
});

test('normalizeBaseUrl removes trailing slash', () => {
  assert.equal(normalizeBaseUrl('https://example.com/'), 'https://example.com');
});

test('buildPostPayload maps row and resolved taxonomy to REST payload', () => {
  const payload = buildPostPayload(
    {
      post_title: 'Judul',
      slug: 'judul-artikel',
      rubrik: 'konsep pelajaran',
      meta_title: 'Meta Title',
      meta_description: 'Meta Description',
    },
    {
      html: '<h1>Judul</h1><p>Isi</p>',
      categoryIds: [11, 12],
      tagIds: [21, 22],
      featuredMediaId: 44,
      status: 'draft',
    }
  );
  assert.deepEqual(payload, {
    title: 'Judul',
    slug: 'judul-artikel',
    content: '<h1>Judul</h1><p>Isi</p>',
    categories: [11, 12],
    tags: [21, 22],
    featured_media: 44,
    status: 'draft',
    meta: {
      rubrik: 'konsep pelajaran',
      _yoast_wpseo_title: 'Meta Title',
      _yoast_wpseo_metadesc: 'Meta Description',
    },
  });
});

test('buildPostPayload can omit status for update_existing', () => {
  const payload = buildPostPayload({ post_title: 'Judul' }, { html: '<p>Isi</p>', categoryIds: [], tagIds: [] });
  assert.equal(Object.hasOwn(payload, 'status'), false);
});

test('buildEditUrl uses configured pattern or default wp-admin pattern', () => {
  assert.equal(buildEditUrl({ wordpress_base_url: 'https://example.com' }, 123), 'https://example.com/wp-admin/post.php?post=123&action=edit');
  assert.equal(
    buildEditUrl({ wordpress_base_url: 'https://example.com', admin_url_pattern: '/admin/edit/{id}' }, 123),
    'https://example.com/admin/edit/123'
  );
});

test('WordPressClient sends authenticated JSON REST requests', () => {
  let capturedUrl = '';
  let capturedOptions = {};
  const client = new WordPressClient({
    site: { wordpress_base_url: 'https://example.com/' },
    credentials: { username: 'admin', appPassword: 'app pass' },
    fetcher: (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        getResponseCode: () => 201,
        getContentText: () => '{"id":123}',
      };
    },
  });

  assert.deepEqual(client.createPost({ title: 'Judul' }), { id: 123 });
  assert.equal(capturedUrl, 'https://example.com/wp-json/wp/v2/posts');
  assert.equal(capturedOptions.method, 'post');
  assert.equal(capturedOptions.contentType, 'application/json');
  assert.equal(capturedOptions.payload, '{"title":"Judul"}');
  assert.equal(capturedOptions.headers.Authorization, buildBasicAuthHeader('admin', 'app pass'));
  assert.equal(capturedOptions.muteHttpExceptions, true);
});

test('WordPressClient throws REST error messages', () => {
  const client = new WordPressClient({
    site: { wordpress_base_url: 'https://example.com' },
    credentials: { username: 'admin', appPassword: 'app pass' },
    fetcher: () => ({
      getResponseCode: () => 400,
      getContentText: () => '{"message":"bad request"}',
    }),
  });

  assert.throws(() => client.getPost(123), /WordPress request failed 400: bad request/);
});
