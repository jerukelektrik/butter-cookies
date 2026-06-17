export const CONTENT_MARKER = '=== START WORDPRESS CONTENT ===';

export const SHEET_NAMES = Object.freeze({
  sites: 'Sites',
  authorizedUsers: 'Authorized Users',
  taxonomyConfig: 'Taxonomy Config',
  uploadLog: 'Upload Log',
});

export const UPLOAD_ACTIONS = Object.freeze(['create_draft', 'update_existing', 'skip']);
export const EDITORIAL_STATUSES = Object.freeze(['publish', 'schedule', 'drafted', 'update']);
export const ARTICLE_TYPES = Object.freeze(['new article', 'rework', 'LHF', 'Low CTR', 'Lost Keywords']);
export const UPLOAD_STATUSES = Object.freeze(['pending', 'validated', 'uploaded', 'updated', 'warning', 'error', 'skipped']);

export const DEFAULT_RUBRIKS = Object.freeze([
  'konsep pelajaran',
  'pojok kampus',
  'fakta seru',
  'seputar ruangguru',
  'for kids',
  'dunia kata',
]);

export const SITE_HEADERS = Object.freeze([
  'site_key',
  'site_name',
  'wordpress_base_url',
  'timezone',
  'default_author',
  'default_post_type',
  'admin_url_pattern',
  'active',
]);

export const AUTHORIZED_USER_HEADERS = Object.freeze(['email', 'name', 'role', 'active']);

export const TAXONOMY_HEADERS = Object.freeze([
  'site_key',
  'type',
  'value',
  'parent_value',
  'wordpress_id',
  'mapping_mode',
  'active',
]);

export const CONTENT_HEADERS = Object.freeze([
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

export const UPLOAD_LOG_HEADERS = Object.freeze([
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

export const META_LIMITS = Object.freeze({
  title: { min: 55, max: 62 },
  description: { min: 155, max: 162 },
});

export function propertyKeyForSite(siteKey, suffix) {
  return `WP_${String(siteKey).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_${suffix}`;
}
