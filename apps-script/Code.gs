/**
 * Butter Cookies - WordPress Content Plan Uploader
 *
 * Generated from src/*.js by scripts/build-gas.mjs.
 * INSTALL: Extensions > Apps Script > paste this Code.gs > Save > Reload sheet.
 */

// --- src/constants.js ---
const CONTENT_MARKER = '=== START WORDPRESS CONTENT ===';

const SHEET_NAMES = Object.freeze({
  sites: 'Sites',
  authorizedUsers: 'Authorized Users',
  taxonomyConfig: 'Taxonomy Config',
  uploadLog: 'Upload Log',
});

const UPLOAD_ACTIONS = Object.freeze(['create_draft', 'update_existing', 'skip']);
const EDITORIAL_STATUSES = Object.freeze(['publish', 'schedule', 'drafted', 'update']);
const ARTICLE_TYPES = Object.freeze(['new article', 'rework', 'LHF', 'Low CTR', 'Lost Keywords']);
const UPLOAD_STATUSES = Object.freeze(['pending', 'validated', 'uploaded', 'updated', 'warning', 'error', 'skipped']);

const DEFAULT_RUBRIKS = Object.freeze([
  'konsep pelajaran',
  'pojok kampus',
  'fakta seru',
  'seputar ruangguru',
  'for kids',
  'dunia kata',
]);

const SITE_HEADERS = Object.freeze([
  'site_key',
  'site_name',
  'wordpress_base_url',
  'timezone',
  'default_author',
  'default_post_type',
  'admin_url_pattern',
  'active',
]);

const AUTHORIZED_USER_HEADERS = Object.freeze(['email', 'name', 'role', 'active']);

const TAXONOMY_HEADERS = Object.freeze([
  'site_key',
  'type',
  'value',
  'parent_value',
  'wordpress_id',
  'mapping_mode',
  'active',
]);

const CONTENT_HEADERS = Object.freeze([
  'upload_action',
  'status',
  'article_type',
  'rubrik',
  'pic',
  'post_title',
  'slug',
  'google_doc_url',
  'parent_category',
  'child_category',
  'tags',
  'featured_image_url',
  'meta_title',
  'meta_title_length',
  'meta_title_check',
  'meta_description',
  'meta_description_length',
  'meta_description_check',
  'wordpress_post_id',
  'wordpress_draft_url',
  'upload_status',
  'validation_notes',
  'error_notes',
  'last_processed_at',
]);

const UPLOAD_LOG_HEADERS = Object.freeze([
  'timestamp',
  'run_id',
  'user_email',
  'site_key',
  'tab_name',
  'row_number',
  'upload_action',
  'wordpress_post_id',
  'result',
  'message',
  'duration_ms',
]);

const META_LIMITS = Object.freeze({
  title: { min: 55, max: 62 },
  description: { min: 155, max: 162 },
});

function propertyKeyForSite(siteKey, suffix) {
  return `WP_${String(siteKey).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_${suffix}`;
}


// --- src/sheets.js ---
function buildHeaderMap(headers) {
  return headers.reduce((map, header, index) => {
    const key = String(header || '').trim();
    if (key) map[key] = index;
    return map;
  }, {});
}

function mapRowToObject(headers, row) {
  return headers.reduce((record, header, index) => {
    const value = row[index];
    record[header] = typeof value === 'string' ? value.trim() : value;
    return record;
  }, {});
}

function getSheetRecords(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  return values.slice(1).map((row, index) => ({
    rowNumber: index + 2,
    values: row,
    record: mapRowToObject(headers, row),
  }));
}

function normalizeBoolean(value) {
  if (value === true) return true;
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'true' || normalized === 'yes' || normalized === '1';
}

function buildMetaLengthFormula(sourceCell) {
  return `=LEN(${sourceCell})`;
}

function buildMetaCheckFormula(lengthCell, kind) {
  const limits = kind === 'title' ? META_LIMITS.title : META_LIMITS.description;
  const label = kind === 'title' ? 'meta title' : 'meta description';
  return `=IF(${lengthCell}="","",IF(${lengthCell}<${limits.min},"${label} too short",IF(${lengthCell}>${limits.max},"${label} too long","")))`;
}

function ensureSheet(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function ensureHeaders(sheet, headers) {
  const firstRow = sheet.getRange(1, 1, 1, headers.length);
  const current = firstRow.getValues()[0];
  const hasAnyHeader = current.some((value) => String(value || '').trim());

  if (!hasAnyHeader) {
    firstRow.setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }

  headers.forEach((header, index) => {
    if (String(current[index] || '').trim() !== header) {
      sheet.getRange(1, index + 1).setValue(header);
    }
  });
  sheet.setFrozenRows(1);
}

function setupSharedSheets(spreadsheet) {
  ensureHeaders(ensureSheet(spreadsheet, SHEET_NAMES.sites), SITE_HEADERS);
  ensureHeaders(ensureSheet(spreadsheet, SHEET_NAMES.authorizedUsers), AUTHORIZED_USER_HEADERS);
  ensureHeaders(ensureSheet(spreadsheet, SHEET_NAMES.taxonomyConfig), TAXONOMY_HEADERS);
  ensureHeaders(ensureSheet(spreadsheet, SHEET_NAMES.uploadLog), UPLOAD_LOG_HEADERS);
}

function setupContentSheet(sheet) {
  ensureHeaders(sheet, CONTENT_HEADERS);
  applyContentDataValidation(sheet);
  applyMetaFormulas(sheet);
  applyMetaConditionalFormatting(sheet);
}

function buildUploadLogRow(headers, entry) {
  return headers.map((header) => entry[header] ?? '');
}

function appendUploadLog(spreadsheet, entry) {
  const sheet = ensureSheet(spreadsheet, SHEET_NAMES.uploadLog);
  ensureHeaders(sheet, UPLOAD_LOG_HEADERS);
  sheet.appendRow(buildUploadLogRow(UPLOAD_LOG_HEADERS, entry));
}

function writeContentRowResult(sheet, rowNumber, result, processedAt = new Date()) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const headerMap = buildHeaderMap(headers);
  const writable = {
    wordpress_post_id: result.wordpress_post_id,
    wordpress_draft_url: result.wordpress_draft_url,
    upload_status: result.status,
    validation_notes: result.validation_notes,
    error_notes: result.error_notes,
    last_processed_at: processedAt,
  };

  Object.entries(writable).forEach(([header, value]) => {
    if (headerMap[header] === undefined || value === undefined) return;
    sheet.getRange(rowNumber, headerMap[header] + 1).setValue(value);
  });
}

function applyContentDataValidation(sheet) {
  if (typeof SpreadsheetApp === 'undefined') return;

  const maxRows = Math.max(sheet.getMaxRows() - 1, 1);
  const validations = [
    { header: 'upload_action', values: UPLOAD_ACTIONS },
    { header: 'status', values: EDITORIAL_STATUSES },
    { header: 'article_type', values: ARTICLE_TYPES },
    { header: 'rubrik', values: DEFAULT_RUBRIKS },
  ];
  const headerMap = buildHeaderMap(CONTENT_HEADERS);

  validations.forEach(({ header, values }) => {
    const column = headerMap[header] + 1;
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(values, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, column, maxRows, 1).setDataValidation(rule);
  });
}

function applyMetaFormulas(sheet) {
  const headerMap = buildHeaderMap(CONTENT_HEADERS);
  const maxRows = Math.max(sheet.getMaxRows() - 1, 1);

  for (let row = 2; row <= maxRows + 1; row += 1) {
    const titleCell = sheet.getRange(row, headerMap.meta_title + 1).getA1Notation();
    const titleLengthCell = sheet.getRange(row, headerMap.meta_title_length + 1).getA1Notation();
    const descCell = sheet.getRange(row, headerMap.meta_description + 1).getA1Notation();
    const descLengthCell = sheet.getRange(row, headerMap.meta_description_length + 1).getA1Notation();

    sheet.getRange(row, headerMap.meta_title_length + 1).setFormula(buildMetaLengthFormula(titleCell));
    sheet.getRange(row, headerMap.meta_title_check + 1).setFormula(buildMetaCheckFormula(titleLengthCell, 'title'));
    sheet.getRange(row, headerMap.meta_description_length + 1).setFormula(buildMetaLengthFormula(descCell));
    sheet
      .getRange(row, headerMap.meta_description_check + 1)
      .setFormula(buildMetaCheckFormula(descLengthCell, 'description'));
  }
}

function applyMetaConditionalFormatting(sheet) {
  if (typeof SpreadsheetApp === 'undefined') return;

  const headerMap = buildHeaderMap(CONTENT_HEADERS);
  const maxRows = Math.max(sheet.getMaxRows() - 1, 1);
  const ranges = [
    sheet.getRange(2, headerMap.meta_title_check + 1, maxRows, 1),
    sheet.getRange(2, headerMap.meta_description_check + 1, maxRows, 1),
  ];
  const rules = ranges.map((range) =>
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('too')
      .setBackground('#f4cccc')
      .setFontColor('#990000')
      .setRanges([range])
      .build()
  );

  sheet.setConditionalFormatRules([...sheet.getConditionalFormatRules(), ...rules]);
}


// --- src/auth.js ---
function findAuthorizedUser(users, email) {
  const target = String(email || '').trim().toLowerCase();
  if (!target) return null;
  return users.find((user) => String(user.email || '').trim().toLowerCase() === target && normalizeBoolean(user.active)) || null;
}

function getCredentialPropertyKeys(siteKey) {
  return {
    usernameKey: propertyKeyForSite(siteKey, 'USERNAME'),
    passwordKey: propertyKeyForSite(siteKey, 'APP_PASSWORD'),
  };
}

function readWordPressCredentials(siteKey, properties) {
  const { usernameKey, passwordKey } = getCredentialPropertyKeys(siteKey);
  return {
    username: properties.getProperty(usernameKey) || '',
    appPassword: properties.getProperty(passwordKey) || '',
  };
}

function maskCredentialStatus(credentials) {
  return {
    hasUsername: Boolean(credentials.username),
    hasAppPassword: Boolean(credentials.appPassword),
  };
}

function assertAuthorizedUser(users, email) {
  const user = findAuthorizedUser(users, email);
  if (!user) {
    throw new Error(`Unauthorized user: ${email || 'unknown'}`);
  }
  return user;
}


// --- src/validation.js ---
function splitTags(value) {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function metaWarnings(row) {
  const warnings = [];
  const titleLength = String(row.meta_title || '').trim().length;
  const descriptionLength = String(row.meta_description || '').trim().length;

  if (titleLength > 0 && titleLength < META_LIMITS.title.min) warnings.push('meta title too short');
  if (titleLength > META_LIMITS.title.max) warnings.push('meta title too long');
  if (descriptionLength > 0 && descriptionLength < META_LIMITS.description.min) {
    warnings.push('meta description too short');
  }
  if (descriptionLength > META_LIMITS.description.max) warnings.push('meta description too long');

  return warnings;
}

function validateContentRow(row, context) {
  const errors = [];
  const warnings = [];
  const action = String(row.upload_action || '').trim();

  if (!UPLOAD_ACTIONS.includes(action)) {
    errors.push(`unsupported upload_action: ${action || 'blank'}`);
    return { errors, warnings, shouldProcess: false };
  }

  if (action === 'skip') {
    warnings.push('row skipped by upload_action');
    return { errors, warnings, shouldProcess: false };
  }

  if (!context.site) errors.push('site config is missing');
  if (!context.credentials?.username || !context.credentials?.appPassword) errors.push('WordPress credentials are missing');
  if (!String(row.post_title || '').trim()) errors.push(`post_title is required for ${action}`);
  if (!String(row.google_doc_url || '').trim()) errors.push('google_doc_url is required');
  if (!context.docHasMarker) errors.push('Google Doc marker is missing');
  if (!String(row.parent_category || '').trim()) errors.push('parent_category is required');
  if (!String(row.child_category || '').trim()) errors.push('child_category is required');
  if (action === 'update_existing' && !String(row.wordpress_post_id || '').trim()) {
    errors.push('wordpress_post_id is required for update_existing');
  }

  warnings.push(...metaWarnings(row));

  return {
    errors,
    warnings,
    shouldProcess: errors.length === 0,
  };
}


// --- src/docs.js ---
function extractGoogleDocId(value) {
  const input = String(value || '').trim();
  const match = input.match(/\/document\/d\/([^/]+)/);
  if (match) return match[1];
  if (/^[A-Za-z0-9_-]+$/.test(input)) return input;
  throw new Error(`Invalid Google Doc URL: ${input}`);
}

function sliceAfterMarker(html) {
  const markerIndex = String(html || '').indexOf(CONTENT_MARKER);
  if (markerIndex === -1) return { html: '', hasMarker: false };

  const afterMarker = html.slice(markerIndex + CONTENT_MARKER.length);
  const withoutMarkerParagraph = afterMarker.replace(/^(\s|<\/?p[^>]*>|<br\s*\/?>|&nbsp;)*/i, '');
  return { html: withoutMarkerParagraph.trim(), hasMarker: true };
}

function cleanExportedHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/^[\s\S]*?<body[^>]*>/i, '')
    .replace(/<\/body>[\s\S]*$/i, '')
    .replace(/\sclass="[^"]*"/gi, '')
    .replace(/\sstyle="[^"]*"/gi, '')
    .replace(/\sid="[^"]*"/gi, '')
    .replace(/<span[^>]*>/gi, '')
    .replace(/<\/span>/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

function fetchGoogleDocExportHtml(docUrl, fetcher = UrlFetchApp.fetch) {
  const docId = extractGoogleDocId(docUrl);
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=html`;
  const response = fetcher(exportUrl, {
    method: 'get',
    muteHttpExceptions: true,
    followRedirects: true,
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error(`Google Doc export failed with HTTP ${status}`);
  }
  const cleaned = cleanExportedHtml(response.getContentText());
  return sliceAfterMarker(cleaned);
}


// --- src/wordpress.js ---
function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function buildBasicAuthHeader(username, appPassword) {
  const raw = `${username}:${appPassword}`;
  if (typeof Buffer !== 'undefined') {
    return `Basic ${Buffer.from(raw).toString('base64')}`;
  }
  return `Basic ${Utilities.base64Encode(raw)}`;
}

function parseTermSearchResult(terms, targetName) {
  const normalized = String(targetName || '').trim().toLowerCase();
  return terms.find((term) => String(term.name || '').trim().toLowerCase() === normalized) || null;
}

function buildMediaHeaders(username, appPassword, filename) {
  return {
    Authorization: buildBasicAuthHeader(username, appPassword),
    'Content-Disposition': `attachment; filename="${filename}"`,
  };
}

function buildPostPayload(row, options) {
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

function buildEditUrl(site, postId) {
  const baseUrl = normalizeBaseUrl(site.wordpress_base_url);
  const pattern = site.admin_url_pattern || '/wp-admin/post.php?post={id}&action=edit';
  return `${baseUrl}${pattern.replace('{id}', encodeURIComponent(postId))}`;
}

class WordPressClient {
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
    const parent = this.resolveTerm('categories', parentCategory);
    const child = this.resolveTerm('categories', childCategory, { parent: parent.id });
    const tagIds = tags.map((tag) => this.resolveTerm('tags', tag).id);
    return { categoryIds: [parent.id, child.id], tagIds };
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


// --- src/uploader.js ---
function processContentRow(row, context, dependencies) {
  try {
    if (row.upload_action === 'skip') {
      return { status: 'skipped', validation_notes: 'row skipped by upload_action' };
    }

    const doc = dependencies.fetchDocHtml(row.google_doc_url);
    const validation = validateContentRow(row, { ...context, docHasMarker: doc.hasMarker });
    if (validation.errors.length) {
      return {
        status: 'error',
        validation_notes: validation.warnings.join('; '),
        error_notes: validation.errors.join('; '),
      };
    }

    const taxonomy = dependencies.resolveTaxonomy({
      parentCategory: row.parent_category,
      childCategory: row.child_category,
      tags: splitTags(row.tags),
    });
    const featuredMediaId = row.featured_image_url ? dependencies.uploadFeaturedImage(row.featured_image_url) : null;
    const payload = buildPostPayload(row, {
      html: doc.html,
      categoryIds: taxonomy.categoryIds,
      tagIds: taxonomy.tagIds,
      featuredMediaId,
      status: row.upload_action === 'create_draft' ? 'draft' : undefined,
    });

    if (row.upload_action === 'create_draft') {
      const created = dependencies.createPost(payload);
      return {
        status: validation.warnings.length ? 'warning' : 'uploaded',
        wordpress_post_id: created.id,
        wordpress_draft_url: dependencies.buildEditUrl(context.site, created.id),
        validation_notes: validation.warnings.join('; '),
      };
    }

    dependencies.getPost(row.wordpress_post_id);
    const updated = dependencies.updatePost(row.wordpress_post_id, payload);
    return {
      status: validation.warnings.length ? 'warning' : 'updated',
      wordpress_post_id: updated.id,
      wordpress_draft_url: dependencies.buildEditUrl(context.site, updated.id),
      validation_notes: validation.warnings.join('; '),
    };
  } catch (error) {
    return {
      status: 'error',
      error_notes: error.message,
    };
  }
}

function createRuntimeDependencies(client, site) {
  return {
    fetchDocHtml: (url) => fetchGoogleDocExportHtml(url),
    resolveTaxonomy: (input) => client.resolveTaxonomy(input),
    uploadFeaturedImage: (url) => client.uploadFeaturedImage(url),
    createPost: (payload) => client.createPost(payload),
    updatePost: (id, payload) => client.updatePost(id, payload),
    getPost: (id) => client.getPost(id),
    buildEditUrl: (_site, id) => buildEditUrl(site, id),
  };
}

function getActiveSites(spreadsheet) {
  const sitesSheet = spreadsheet.getSheetByName(SHEET_NAMES.sites);
  if (!sitesSheet) return [];
  return getSheetRecords(sitesSheet)
    .map(({ record }) => record)
    .filter((site) => site.site_key && normalizeBoolean(site.active));
}

function getAuthorizedUsers(spreadsheet) {
  const usersSheet = spreadsheet.getSheetByName(SHEET_NAMES.authorizedUsers);
  if (!usersSheet) return [];
  return getSheetRecords(usersSheet).map(({ record }) => record);
}

function getSiteForSheet(spreadsheet, sheet) {
  const sheetName = sheet.getName();
  return getActiveSites(spreadsheet).find((site) => site.site_key === sheetName) || null;
}

function getContentRows(sheet) {
  return getSheetRecords(sheet).filter(({ record }) => String(record.upload_action || '').trim());
}

function generateRunId() {
  if (typeof Utilities !== 'undefined' && Utilities.getUuid) return Utilities.getUuid();
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function withUploadLock(callback, options = {}) {
  const lock = options.lock || (typeof LockService !== 'undefined' ? LockService.getScriptLock() : null);
  if (!lock) return callback();
  if (!lock.tryLock(1000)) {
    throw new Error('Another upload run is already active.');
  }
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function runPreviewForActiveSheet(spreadsheet, userEmail, options = {}) {
  const sheet = spreadsheet.getActiveSheet();
  const site = getSiteForSheet(spreadsheet, sheet);
  return runPreviewForSheet(spreadsheet, sheet, site, userEmail, options);
}

function runPreviewForAllSites(spreadsheet, userEmail, options = {}) {
  return getActiveSites(spreadsheet).map((site) => {
    const sheet = spreadsheet.getSheetByName(site.site_key);
    if (!sheet) {
      return { site_key: site.site_key, processed: 0, errors: 1, message: `Sheet not found: ${site.site_key}` };
    }
    return runPreviewForSheet(spreadsheet, sheet, site, userEmail, options);
  });
}

function runUploadForActiveSheet(spreadsheet, userEmail, options = {}) {
  return withUploadLock(() => {
    const sheet = spreadsheet.getActiveSheet();
    const site = getSiteForSheet(spreadsheet, sheet);
    return runUploadForSheet(spreadsheet, sheet, site, userEmail, { ...options, runId: options.runId || generateRunId() });
  }, options);
}

function runUploadForAllSites(spreadsheet, userEmail, options = {}) {
  return withUploadLock(() => {
    const runId = options.runId || generateRunId();
    return getActiveSites(spreadsheet).map((site) => {
      const sheet = spreadsheet.getSheetByName(site.site_key);
      if (!sheet) {
        return { site_key: site.site_key, processed: 0, errors: 1, message: `Sheet not found: ${site.site_key}` };
      }
      return runUploadForSheet(spreadsheet, sheet, site, userEmail, { ...options, runId });
    });
  }, options);
}

function runPreviewForSheet(spreadsheet, sheet, site, userEmail, options = {}) {
  assertAuthorizedUser(getAuthorizedUsers(spreadsheet), userEmail);
  const properties = options.properties || PropertiesService.getScriptProperties();
  const credentials = site ? readWordPressCredentials(site.site_key, properties) : { username: '', appPassword: '' };
  const fetchDocHtml = options.fetchDocHtml || fetchGoogleDocExportHtml;
  const processedAt = options.processedAt || new Date();
  const runId = options.runId || generateRunId();
  const rows = getContentRows(sheet);
  const summary = { site_key: site?.site_key || sheet.getName(), userEmail, runId, processed: 0, errors: 0, warnings: 0 };

  rows.forEach(({ rowNumber, record }) => {
    let doc = { hasMarker: false };
    try {
      doc = record.google_doc_url ? fetchDocHtml(record.google_doc_url) : { hasMarker: false };
    } catch (error) {
      doc = { hasMarker: false, error };
    }

    const validation = validateContentRow(record, { site, credentials, docHasMarker: doc.hasMarker });
    const result = {
      status: validation.errors.length ? 'error' : validation.warnings.length ? 'warning' : 'validated',
      validation_notes: validation.warnings.join('; '),
      error_notes: [...validation.errors, doc.error?.message].filter(Boolean).join('; '),
    };
    writeContentRowResult(sheet, rowNumber, result, processedAt);
    appendUploadLog(spreadsheet, {
      timestamp: processedAt,
      run_id: runId,
      user_email: userEmail,
      site_key: summary.site_key,
      tab_name: sheet.getName(),
      row_number: rowNumber,
      upload_action: record.upload_action,
      wordpress_post_id: record.wordpress_post_id,
      result: result.status,
      message: [result.validation_notes, result.error_notes].filter(Boolean).join('; '),
    });
    summary.processed += 1;
    if (result.status === 'error') summary.errors += 1;
    if (result.status === 'warning') summary.warnings += 1;
  });

  return summary;
}

function runUploadForSheet(spreadsheet, sheet, site, userEmail, options = {}) {
  assertAuthorizedUser(getAuthorizedUsers(spreadsheet), userEmail);
  const properties = options.properties || PropertiesService.getScriptProperties();
  const credentials = site ? readWordPressCredentials(site.site_key, properties) : { username: '', appPassword: '' };
  const processedAt = options.processedAt || new Date();
  const runId = options.runId || generateRunId();
  const client =
    options.client ||
    (site
      ? new WordPressClient({
          site,
          credentials,
          fetcher: options.fetcher || UrlFetchApp.fetch,
        })
      : null);
  const dependencies = options.dependencies || createRuntimeDependencies(client || {}, site || {});
  const rows = getContentRows(sheet);
  const summary = { site_key: site?.site_key || sheet.getName(), userEmail, runId, processed: 0, errors: 0, warnings: 0 };

  rows.forEach(({ rowNumber, record }) => {
    const result = processContentRow(record, { site, credentials }, dependencies);
    writeContentRowResult(sheet, rowNumber, result, processedAt);
    appendUploadLog(spreadsheet, {
      timestamp: processedAt,
      run_id: runId,
      user_email: userEmail,
      site_key: summary.site_key,
      tab_name: sheet.getName(),
      row_number: rowNumber,
      upload_action: record.upload_action,
      wordpress_post_id: result.wordpress_post_id || record.wordpress_post_id,
      result: result.status,
      message: [result.validation_notes, result.error_notes].filter(Boolean).join('; '),
    });
    summary.processed += 1;
    if (result.status === 'error') summary.errors += 1;
    if (result.status === 'warning') summary.warnings += 1;
  });

  return summary;
}


// --- src/Code.js ---
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('WP Content Uploader')
    .addItem('Setup Template', 'setupTemplate')
    .addSeparator()
    .addItem('Validate/Preview Current Site', 'validatePreviewCurrentSite')
    .addItem('Validate/Preview All Sites', 'validatePreviewAllSites')
    .addSeparator()
    .addItem('Upload Current Site', 'uploadCurrentSite')
    .addItem('Upload All Sites', 'uploadAllSites')
    .addToUi();
}

function setupTemplate() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  setupSharedSheets(spreadsheet);

  const sitesSheet = spreadsheet.getSheetByName(SHEET_NAMES.sites);
  const values = sitesSheet.getDataRange().getValues();
  const headers = values[0] || [];
  const siteKeyIndex = headers.indexOf('site_key');
  const activeIndex = headers.indexOf('active');

  values.slice(1).forEach((row) => {
    const siteKey = String(row[siteKeyIndex] || '').trim();
    const active = String(row[activeIndex] || '').trim().toUpperCase() === 'TRUE';
    if (siteKey && active) {
      setupContentSheet(spreadsheet.getSheetByName(siteKey) || spreadsheet.insertSheet(siteKey));
    }
  });

  SpreadsheetApp.getUi().alert('Template setup complete.');
}

function validatePreviewCurrentSite() {
  runPreviewForActiveSheet(SpreadsheetApp.getActiveSpreadsheet(), Session.getActiveUser().getEmail());
}

function validatePreviewAllSites() {
  runPreviewForAllSites(SpreadsheetApp.getActiveSpreadsheet(), Session.getActiveUser().getEmail());
}

function uploadCurrentSite() {
  runUploadForActiveSheet(SpreadsheetApp.getActiveSpreadsheet(), Session.getActiveUser().getEmail());
}

function uploadAllSites() {
  runUploadForAllSites(SpreadsheetApp.getActiveSpreadsheet(), Session.getActiveUser().getEmail());
}

if (typeof globalThis !== 'undefined') {
  globalThis.onOpen = onOpen;
  globalThis.setupTemplate = setupTemplate;
  globalThis.validatePreviewCurrentSite = validatePreviewCurrentSite;
  globalThis.validatePreviewAllSites = validatePreviewAllSites;
  globalThis.uploadCurrentSite = uploadCurrentSite;
  globalThis.uploadAllSites = uploadAllSites;
}
