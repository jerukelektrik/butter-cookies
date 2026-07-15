import { SHEET_NAMES } from './constants.js';
import { assertAuthorizedUser, readWordPressCredentials } from './auth.js';
import { fetchGoogleDocExportHtml } from './docs.js';
import { appendUploadLog, getSheetRecords, normalizeBoolean, writeContentRowResult } from './sheets.js';
import { validateContentRow, splitTags } from './validation.js';
import { WordPressClient, buildPostPayload, buildEditUrl } from './wordpress.js';

export function processContentRow(row, context, dependencies) {
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

export function createRuntimeDependencies(client, site) {
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

export function getActiveSites(spreadsheet) {
  const sitesSheet = spreadsheet.getSheetByName(SHEET_NAMES.sites);
  if (!sitesSheet) return [];
  return getSheetRecords(sitesSheet)
    .map(({ record }) => record)
    .filter((site) => site.site_key && normalizeBoolean(site.active));
}

export function getAuthorizedUsers(spreadsheet) {
  const usersSheet = spreadsheet.getSheetByName(SHEET_NAMES.authorizedUsers);
  if (!usersSheet) return [];
  return getSheetRecords(usersSheet).map(({ record }) => record);
}

export function getSiteForSheet(spreadsheet, sheet) {
  const sheetName = sheet.getName();
  return getActiveSites(spreadsheet).find((site) => site.site_key === sheetName) || null;
}

export function getContentRows(sheet) {
  return getSheetRecords(sheet).filter(({ record }) => String(record.upload_action || '').trim());
}

export function generateRunId() {
  if (typeof Utilities !== 'undefined' && Utilities.getUuid) return Utilities.getUuid();
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function withUploadLock(callback, options = {}) {
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

export function runPreviewForActiveSheet(spreadsheet, userEmail, options = {}) {
  const sheet = spreadsheet.getActiveSheet();
  const site = getSiteForSheet(spreadsheet, sheet);
  return runPreviewForSheet(spreadsheet, sheet, site, userEmail, options);
}

export function runPreviewForAllSites(spreadsheet, userEmail, options = {}) {
  return getActiveSites(spreadsheet).map((site) => {
    const sheet = spreadsheet.getSheetByName(site.site_key);
    if (!sheet) {
      return { site_key: site.site_key, processed: 0, errors: 1, message: `Sheet not found: ${site.site_key}` };
    }
    return runPreviewForSheet(spreadsheet, sheet, site, userEmail, options);
  });
}

export function runUploadForActiveSheet(spreadsheet, userEmail, options = {}) {
  return withUploadLock(() => {
    const sheet = spreadsheet.getActiveSheet();
    const site = getSiteForSheet(spreadsheet, sheet);
    return runUploadForSheet(spreadsheet, sheet, site, userEmail, { ...options, runId: options.runId || generateRunId() });
  }, options);
}

export function runUploadForAllSites(spreadsheet, userEmail, options = {}) {
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

export function runPreviewForSheet(spreadsheet, sheet, site, userEmail, options = {}) {
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

export function runUploadForSheet(spreadsheet, sheet, site, userEmail, options = {}) {
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

export function runTestConnectionForActiveSheet(spreadsheet, userEmail, options = {}) {
  assertAuthorizedUser(getAuthorizedUsers(spreadsheet), userEmail);
  const sheet = spreadsheet.getActiveSheet();
  const site = getSiteForSheet(spreadsheet, sheet);
  if (!site) {
    throw new Error(`Active sheet "${sheet.getName()}" does not match any active site in the "Sites" tab.`);
  }

  const properties = options.properties || PropertiesService.getScriptProperties();
  const credentials = readWordPressCredentials(site.site_key, properties);

  if (!credentials.username || !credentials.appPassword) {
    throw new Error(`Credentials for "${site.site_key}" are missing in Script Properties. Ensure WP_${site.site_key.toUpperCase()}_USERNAME and WP_${site.site_key.toUpperCase()}_APP_PASSWORD are set.`);
  }

  const client =
    options.client ||
    new WordPressClient({
      site,
      credentials,
      fetcher: options.fetcher || UrlFetchApp.fetch,
    });

  try {
    const response = client.getCurrentUser('view');
    let roles = [];
    let capabilities = {};
    try {
      const editResponse = client.getCurrentUser('edit');
      roles = editResponse.roles || [];
      capabilities = editResponse.capabilities || {};
    } catch (e) {
      // Ignored if user doesn't have permission to query edit profile context
    }
    return {
      success: true,
      username: response.slug || response.username || '',
      name: response.name || '',
      id: response.id,
      roles,
      capabilities,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

