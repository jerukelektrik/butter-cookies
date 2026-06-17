export function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function buildBasicAuthHeader(username, appPassword) {
  const raw = `${username}:${appPassword}`;
  if (typeof Buffer !== 'undefined') {
    return `Basic ${Buffer.from(raw).toString('base64')}`;
  }
  return `Basic ${Utilities.base64Encode(raw)}`;
}

export function buildPostPayload(row, options) {
  const payload = {
    title: row.post_title,
    content: options.html,
    categories: options.categoryIds || [],
    tags: options.tagIds || [],
    meta: {
      rubrik: row.rubrik || '',
      _yoast_wpseo_title: row.meta_title || '',
      _yoast_wpseo_metadesc: row.meta_description || '',
    },
  };

  if (row.slug) payload.slug = row.slug;
  if (options.featuredMediaId) payload.featured_media = options.featuredMediaId;
  if (options.status) payload.status = options.status;

  return payload;
}

export function buildEditUrl(site, postId) {
  const baseUrl = normalizeBaseUrl(site.wordpress_base_url);
  const pattern = site.admin_url_pattern || '/wp-admin/post.php?post={id}&action=edit';
  return `${baseUrl}${pattern.replace('{id}', encodeURIComponent(postId))}`;
}

export class WordPressClient {
  constructor({ site, credentials, fetcher = UrlFetchApp.fetch }) {
    this.site = site;
    this.credentials = credentials;
    this.fetcher = fetcher;
    this.baseUrl = normalizeBaseUrl(site.wordpress_base_url);
  }

  request(path, options = {}) {
    const response = this.fetcher(`${this.baseUrl}${path}`, {
      method: options.method || 'get',
      contentType: options.contentType || 'application/json',
      payload: options.payload ? JSON.stringify(options.payload) : undefined,
      headers: {
        Authorization: buildBasicAuthHeader(this.credentials.username, this.credentials.appPassword),
        ...(options.headers || {}),
      },
      muteHttpExceptions: true,
    });
    const status = response.getResponseCode();
    const text = response.getContentText();
    const body = text ? JSON.parse(text) : {};
    if (status < 200 || status >= 300) {
      throw new Error(`WordPress request failed ${status}: ${body.message || text}`);
    }
    return body;
  }

  createPost(payload) {
    return this.request('/wp-json/wp/v2/posts', { method: 'post', payload });
  }

  updatePost(postId, payload) {
    return this.request(`/wp-json/wp/v2/posts/${encodeURIComponent(postId)}`, { method: 'post', payload });
  }

  getPost(postId) {
    return this.request(`/wp-json/wp/v2/posts/${encodeURIComponent(postId)}`);
  }
}
