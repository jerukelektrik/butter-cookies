import { SHEET_NAMES } from './constants.js';
import { assertAuthorizedUser, readWordPressCredentials } from './auth.js';
import { fetchGoogleDocExportHtml } from './docs.js';
import { getSheetRecords, normalizeBoolean, writeContentRowResult } from './sheets.js';
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
  const sheet = spreadsheet.getActiveSheet();
  const site = getSiteForSheet(spreadsheet, sheet);
  return runUploadForSheet(spreadsheet, sheet, site, userEmail, options);
}

export function runUploadForAllSites(spreadsheet, userEmail, options = {}) {
  return getActiveSites(spreadsheet).map((site) => {
    const sheet = spreadsheet.getSheetByName(site.site_key);
    if (!sheet) {
      return { site_key: site.site_key, processed: 0, errors: 1, message: `Sheet not found: ${site.site_key}` };
    }
    return runUploadForSheet(spreadsheet, sheet, site, userEmail, options);
  });
}

export function runPreviewForSheet(spreadsheet, sheet, site, userEmail, options = {}) {
  assertAuthorizedUser(getAuthorizedUsers(spreadsheet), userEmail);
  const properties = options.properties || PropertiesService.getScriptProperties();
  const credentials = site ? readWordPressCredentials(site.site_key, properties) : { username: '', appPassword: '' };
  const fetchDocHtml = options.fetchDocHtml || fetchGoogleDocExportHtml;
  const processedAt = options.processedAt || new Date();
  const rows = getContentRows(sheet);
  const summary = { site_key: site?.site_key || sheet.getName(), userEmail, processed: 0, errors: 0, warnings: 0 };

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
  const summary = { site_key: site?.site_key || sheet.getName(), userEmail, processed: 0, errors: 0, warnings: 0 };

  rows.forEach(({ rowNumber, record }) => {
    const result = processContentRow(record, { site, credentials }, dependencies);
    writeContentRowResult(sheet, rowNumber, result, processedAt);
    summary.processed += 1;
    if (result.status === 'error') summary.errors += 1;
    if (result.status === 'warning') summary.warnings += 1;
  });

  return summary;
}
