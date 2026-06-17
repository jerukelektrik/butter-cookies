import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WordPressClient,
  buildBasicAuthHeader,
  buildEditUrl,
  buildMediaHeaders,
  buildPostPayload,
  normalizeBaseUrl,
  parseTermSearchResult,
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

test('buildMediaHeaders creates content disposition with filename', () => {
  assert.deepEqual(buildMediaHeaders('admin', 'secret', 'image.jpg'), {
    Authorization: buildBasicAuthHeader('admin', 'secret'),
    'Content-Disposition': 'attachment; filename="image.jpg"',
  });
});

test('parseTermSearchResult returns exact case-insensitive match', () => {
  const terms = [
    { id: 1, name: 'Bahasa Indonesia' },
    { id: 2, name: 'IPA' },
  ];
  assert.deepEqual(parseTermSearchResult(terms, 'bahasa indonesia'), { id: 1, name: 'Bahasa Indonesia' });
});

test('WordPressClient resolves existing and new taxonomy terms', () => {
  const calls = [];
  const client = new WordPressClient({
    site: { wordpress_base_url: 'https://example.com' },
    credentials: { username: 'admin', appPassword: 'app pass' },
    fetcher: (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/wp-json/wp/v2/categories?search=Parent')) {
        return {
          getResponseCode: () => 200,
          getContentText: () => '[{"id":11,"name":"Parent"}]',
        };
      }
      if (url.endsWith('/wp-json/wp/v2/categories?search=Child')) {
        return {
          getResponseCode: () => 200,
          getContentText: () => '[]',
        };
      }
      if (url.endsWith('/wp-json/wp/v2/categories')) {
        return {
          getResponseCode: () => 201,
          getContentText: () => '{"id":12,"name":"Child","parent":11}',
        };
      }
      if (url.endsWith('/wp-json/wp/v2/tags?search=tag%20one')) {
        return {
          getResponseCode: () => 200,
          getContentText: () => '[{"id":21,"name":"Tag One"}]',
        };
      }
      if (url.endsWith('/wp-json/wp/v2/tags?search=tag%20two')) {
        return {
          getResponseCode: () => 200,
          getContentText: () => '[]',
        };
      }
      if (url.endsWith('/wp-json/wp/v2/tags')) {
        return {
          getResponseCode: () => 201,
          getContentText: () => '{"id":22,"name":"tag two"}',
        };
      }
      throw new Error(`Unexpected URL ${url}`);
    },
  });

  assert.deepEqual(
    client.resolveTaxonomy({ parentCategory: 'Parent', childCategory: 'Child', tags: ['tag one', 'tag two'] }),
    { categoryIds: [11, 12], tagIds: [21, 22] }
  );
  assert.equal(calls[2].options.payload, '{"name":"Child","parent":11}');
  assert.equal(calls[5].options.payload, '{"name":"tag two"}');
});

test('WordPressClient downloads and uploads featured image', () => {
  const blob = { bytes: 'fake image' };
  const calls = [];
  const client = new WordPressClient({
    site: { wordpress_base_url: 'https://example.com' },
    credentials: { username: 'admin', appPassword: 'app pass' },
    fetcher: (url, options) => {
      calls.push({ url, options });
      if (url === 'https://cdn.example.com/images/photo.jpg?size=large') {
        return {
          getResponseCode: () => 200,
          getBlob: () => blob,
        };
      }
      if (url === 'https://example.com/wp-json/wp/v2/media') {
        return {
          getResponseCode: () => 201,
          getContentText: () => '{"id":44}',
        };
      }
      throw new Error(`Unexpected URL ${url}`);
    },
  });

  assert.equal(client.uploadFeaturedImage('https://cdn.example.com/images/photo.jpg?size=large'), 44);
  assert.equal(calls[1].options.method, 'post');
  assert.equal(calls[1].options.payload, blob);
  assert.deepEqual(calls[1].options.headers, buildMediaHeaders('admin', 'app pass', 'photo.jpg'));
});
