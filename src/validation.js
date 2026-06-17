import { META_LIMITS, UPLOAD_ACTIONS } from './constants.js';

export function splitTags(value) {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function metaWarnings(row) {
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

export function validateContentRow(row, context) {
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
