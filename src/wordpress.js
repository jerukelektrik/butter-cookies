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

export function parseTermSearchResult(terms, targetName) {
  const normalized = String(targetName || '').trim().toLowerCase();
  return terms.find((term) => String(term.name || '').trim().toLowerCase() === normalized) || null;
}

export function buildMediaHeaders(username, appPassword, filename) {
  return {
    Authorization: buildBasicAuthHeader(username, appPassword),
    'Content-Disposition': `attachment; filename="${filename}"`,
  };
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

  getCurrentUser(context = 'view') {
    const path = `/wp-json/wp/v2/users/me${context === 'edit' ? '?context=edit' : ''}`;
    return this.request(path);
  }

  searchTerms(taxonomy, name) {
    return this.request(`/wp-json/wp/v2/${taxonomy}?search=${encodeURIComponent(name)}`);
  }

  createTerm(taxonomy, payload) {
    return this.request(`/wp-json/wp/v2/${taxonomy}`, { method: 'post', payload });
  }

  resolveTerm(taxonomy, name, extraPayload = {}) {
    const existing = parseTermSearchResult(this.searchTerms(taxonomy, name), name);
    if (existing) return existing;
    return this.createTerm(taxonomy, { name, ...extraPayload });
  }

  resolveTaxonomy({ parentCategory, childCategory, tags }) {
    const categoryIds = [];
    if (parentCategory && String(parentCategory).trim()) {
      const parent = this.resolveTerm('categories', parentCategory);
      categoryIds.push(parent.id);
      if (childCategory && String(childCategory).trim()) {
        const child = this.resolveTerm('categories', childCategory, { parent: parent.id });
        categoryIds.push(child.id);
      }
    } else if (childCategory && String(childCategory).trim()) {
      const child = this.resolveTerm('categories', childCategory);
      categoryIds.push(child.id);
    }
    const tagIds = (tags || []).map((tag) => this.resolveTerm('tags', tag).id);
    return { categoryIds, tagIds };
  }

  uploadFeaturedImage(imageUrl) {
    const imageResponse = this.fetcher(imageUrl, { method: 'get', muteHttpExceptions: true });
    const imageStatus = imageResponse.getResponseCode();
    if (imageStatus < 200 || imageStatus >= 300) {
      throw new Error(`Featured image download failed with HTTP ${imageStatus}`);
    }

    const filename = imageUrl.split('/').pop().split('?')[0] || 'featured-image.jpg';
    const uploadResponse = this.fetcher(`${this.baseUrl}/wp-json/wp/v2/media`, {
      method: 'post',
      payload: imageResponse.getBlob(),
      headers: buildMediaHeaders(this.credentials.username, this.credentials.appPassword, filename),
      muteHttpExceptions: true,
    });
    const uploadStatus = uploadResponse.getResponseCode();
    const text = uploadResponse.getContentText();
    const body = text ? JSON.parse(text) : {};
    if (uploadStatus < 200 || uploadStatus >= 300) {
      throw new Error(`Featured image upload failed ${uploadStatus}: ${body.message || text}`);
    }
    return body.id;
  }
}
