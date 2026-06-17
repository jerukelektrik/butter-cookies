import { fetchGoogleDocExportHtml } from './docs.js';
import { validateContentRow, splitTags } from './validation.js';
import { buildPostPayload, buildEditUrl } from './wordpress.js';

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
