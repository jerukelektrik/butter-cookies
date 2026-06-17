# WordPress Content Plan Uploader Design

Date: 2026-06-17
Status: Draft for user review

## 1. Summary

This project will create a Google Apps Script tool attached to a Google Spreadsheet content plan. The tool will upload finished articles from Google Docs into one or more WordPress sites through the WordPress REST API.

The spreadsheet remains the operational center for editors and freelance writers. It stores content workflow status, article type, taxonomy, metadata, Google Doc links, featured image URLs, WordPress IDs, upload results, and logs. Google Docs remain the writing and review space. WordPress receives either new draft posts or updates to existing posts.

The first version is intentionally practical: no article generation, no separate dashboard, no automatic publishing schedule, and no inline image migration from Google Docs. The tool focuses on reliable upload, validation, multi-site configuration, and clear logging.

## 2. Goals

- Build an all-in-one Google Apps Script workflow for Google Sheets.
- Support multiple WordPress websites from one spreadsheet.
- Use one content tab per website.
- Read finished article content from Google Docs.
- Ignore assignment, research, outline, and review sections above a clear content marker.
- Upload new articles as WordPress drafts.
- Update existing WordPress posts by `wordpress_post_id` while preserving the current WordPress post status.
- Upload public featured image URLs to the WordPress Media Library and set them as featured images.
- Support parent category, child category, comma-separated tags, rubrik, PIC, slug, Yoast SEO title, and Yoast SEO description.
- Add Google Sheets template setup, dropdowns, formulas, validation warnings, and conditional formatting.
- Let authorized editors run preview/upload from a Google Sheets menu without exposing WordPress credentials.
- Record results and errors back into the sheet and an upload log.

## 3. Non-Goals

- Generate or rewrite article content.
- Publish new posts directly in the MVP.
- Automatically schedule posts in WordPress.
- Build a standalone web dashboard.
- Process inline images from Google Docs.
- Preserve complex Google Docs layouts such as text boxes, multi-column layouts, or design-heavy tables.
- Auto-fix SEO titles or descriptions.
- Read or upload briefing tables above the WordPress content marker.
- Replace WordPress editorial review, Yoast UI review, or manual QA.

## 4. Recommended Approach

Use Google Apps Script as the first implementation.

Reasons:

- The user's workflow is centered on Google Sheets and Google Docs.
- Apps Script can create spreadsheet menus, dropdowns, formulas, formatting, triggers, and direct integrations.
- Manual or scheduled execution can be configured by the user later without changing the core uploader.
- WordPress credentials can be stored outside the sheet in Apps Script Properties.

Alternatives considered:

- A Node.js uploader service would be more scalable, but requires hosting, deployment, secret management, and monitoring.
- A WordPress plugin per site would offer deep WordPress control, but is harder to maintain across multiple sites.

## 5. Spreadsheet Structure

The spreadsheet contains shared configuration tabs plus one tab per website.

### 5.1 `Sites`

Stores non-secret site configuration.

Required columns:

- `site_key`
- `site_name`
- `wordpress_base_url`
- `timezone`
- `default_author`
- `default_post_type`
- `active`

Example:

| site_key | site_name | wordpress_base_url | timezone | default_author | default_post_type | active |
| --- | --- | --- | --- | --- | --- | --- |
| ruangguru | Ruangguru Blog | https://www.ruangguru.com | Asia/Jakarta | 12 | posts | TRUE |

WordPress usernames and application passwords are not stored here.

### 5.2 `Authorized Users`

Stores editor/admin emails allowed to run validation and upload actions.

Required columns:

- `email`
- `name`
- `role`
- `active`

Only rows with `active = TRUE` can run upload commands.

### 5.3 `Taxonomy Config`

Stores allowed or configured taxonomy values per site.

Required columns:

- `site_key`
- `type`
- `value`
- `parent_value`
- `wordpress_id`
- `mapping_mode`
- `active`

Supported `type` values:

- `rubrik`
- `parent_category`
- `child_category`
- `tag`

Rubrik examples for the Ruangguru site:

- `konsep pelajaran`
- `pojok kampus`
- `fakta seru`
- `seputar ruangguru`
- `for kids`
- `dunia kata`

Default rubrik behavior in the MVP is to store rubrik as a custom field. Per-site configuration can later map rubrik to a category or tag if needed.

### 5.4 Website Content Tabs

Each website has its own content tab, for example:

- `ruangguru`
- `mitrasatwa`
- `sukusastra`

Each content tab uses the same column pattern:

| Column | Purpose |
| --- | --- |
| `upload_action` | Tool action: `create_draft`, `update_existing`, or `skip` |
| `status` | Editorial status: `publish`, `schedule`, `drafted`, or `update` |
| `article_type` | Content/SEO type: `new article`, `rework`, `LHF`, `Low CTR`, `Lost Keywords` |
| `rubrik` | Site-specific rubrik |
| `pic` | Person in charge |
| `post_title` | WordPress post title |
| `slug` | Desired WordPress slug |
| `google_doc_url` | Source Google Doc |
| `parent_category` | Parent WordPress category |
| `child_category` | Child WordPress category |
| `tags` | Comma-separated tags, for example `kelas 12, konsep pelajaran, sma` |
| `featured_image_url` | Public URL for featured image |
| `meta_title` | Yoast SEO title |
| `meta_title_length` | Character count formula |
| `meta_title_check` | Title length warning |
| `meta_description` | Yoast SEO description |
| `meta_description_length` | Character count formula |
| `meta_description_check` | Description length warning |
| `wordpress_post_id` | WordPress post ID after create, or required ID for update |
| `wordpress_draft_url` | WordPress draft/edit URL when available |
| `upload_status` | Process status |
| `validation_notes` | Non-blocking validation warnings |
| `error_notes` | Blocking or upload errors |
| `last_processed_at` | Last validation/upload timestamp |

Allowed `upload_action` values:

- `create_draft`
- `update_existing`
- `skip`

`status` remains the editorial workflow field and should not be overwritten by the uploader.

Allowed `status` values:

- `publish`
- `schedule`
- `drafted`
- `update`

Allowed `article_type` values:

- `new article`
- `rework`
- `LHF`
- `Low CTR`
- `Lost Keywords`

### 5.5 `Upload Log`

Stores append-only process history.

Suggested columns:

- `timestamp`
- `run_id`
- `user_email`
- `site_key`
- `tab_name`
- `row_number`
- `upload_action`
- `wordpress_post_id`
- `result`
- `message`
- `duration_ms`

## 6. Apps Script Menu

When the spreadsheet opens, Apps Script adds a custom menu.

Menu items:

- `Setup Template`
- `Validate/Preview Current Site`
- `Validate/Preview All Sites`
- `Upload Current Site`
- `Upload All Sites`

`Setup Template` creates or repairs the expected tabs, headers, dropdowns, formulas, and conditional formatting.

`Validate/Preview` checks the rows and writes validation notes without changing WordPress.

`Upload` performs the WordPress write actions for eligible rows.

## 7. Template Setup

`Setup Template` should:

- Create missing shared tabs.
- Create missing website content tabs when configured in `Sites`.
- Add standard headers.
- Freeze the first row.
- Add dropdowns for:
  - `upload_action`
  - `status`
  - `article_type`
  - `rubrik`
- Add formulas for:
  - `meta_title_length`
  - `meta_description_length`
  - `meta_title_check`
  - `meta_description_check`
- Add conditional formatting for SEO warnings.

SEO validation rules:

- `meta_title` should be 55-62 characters.
- If title length is under 55, show `meta title too short`.
- If title length is over 62, show `meta title too long`.
- `meta_description` should be 155-162 characters.
- If description length is under 155, show `meta description too short`.
- If description length is over 162, show `meta description too long`.

SEO length warnings are not blockers. They are shown in red and copied into validation notes.

## 8. Google Doc Pattern

Google Docs may contain assignment records, keyword research, outline, review notes, revision notes, and writer guidelines above the final article.

The uploader must ignore everything before this exact marker:

```text
=== START WORDPRESS CONTENT ===
```

Only content after that marker is converted and uploaded to WordPress.

Recommended Google Doc structure:

```text
RG's Guideline for SEO Content Writing

0. Assignment Record
[Internal table for assigned date, assigned type, content performance, writer, notes]

1. Keyword Research
[Internal table for primary keyword, secondary keywords, volume, and notes]

2. Start Outline
[Internal category, tag, target rank, current position, meta title, meta description, references]

3. Content Writing
[Internal writing rules and review notes]

=== START WORDPRESS CONTENT ===

[Heading 1] Perbedaan Teks Eksplanasi dan Teks Eksposisi

Intro artikel 2-3 paragraf. Keyword utama sebaiknya muncul natural di paragraf pertama.

[Heading 2] Apa Itu Teks Eksplanasi?

Paragraf penjelasan.

[Heading 3] Ciri-Ciri Teks Eksplanasi

- Poin pertama
- Poin kedua
- Poin ketiga

[Heading 2] Apa Itu Teks Eksposisi?

Paragraf penjelasan.

[Heading 2] Perbedaan Teks Eksplanasi dan Teks Eksposisi

Isi perbandingan dalam paragraf, list, atau tabel sederhana jika nanti didukung.

[Heading 2] Kesimpulan

Ringkasan pendek dan CTA penutup.
```

Authoring rules:

- Use Heading 1 for the article title.
- Use Heading 2 for main sections.
- Use Heading 3 for subsection points.
- Add links directly in Google Docs using anchor text.
- Do not rely on raw pasted URLs if anchor text matters.
- Avoid complex layouts after the marker.
- Inline images after the marker are ignored in the MVP.
- Featured image must come from `featured_image_url` in the sheet.
- Google Docs comments and suggestions are not uploaded.

If the marker is missing, validation should flag the row. Upload should not proceed for that row because uploading the full brief by mistake is worse than skipping.

## 9. Content Conversion

Apps Script converts Google Doc content after the marker to HTML.

MVP conversion scope:

- Heading 1 to `<h1>`
- Heading 2 to `<h2>`
- Heading 3 to `<h3>`
- Paragraphs to `<p>`
- Bold to `<strong>`
- Italic to `<em>`
- Links to `<a href="">`
- Ordered lists to `<ol><li>`
- Unordered lists to `<ul><li>`

The MVP can ignore or simplify:

- Inline images
- Comments
- Suggestions
- Complex tables
- Text boxes
- Multi-column layouts
- Decorative formatting

## 10. WordPress Integration

The tool uses the WordPress REST API with Application Password authentication.

Credential storage:

- Store credentials in Apps Script Properties.
- Use a per-site naming pattern such as:
  - `WP_RUANGGURU_USERNAME`
  - `WP_RUANGGURU_APP_PASSWORD`
- The spreadsheet never stores WordPress passwords.

### 10.1 Create Draft

For `upload_action = create_draft`, the tool:

1. Validates the row.
2. Reads and converts the Google Doc after the marker.
3. Resolves or creates taxonomy terms.
4. Uploads the featured image if provided.
5. Creates a new WordPress post with `status = draft`.
6. Writes Yoast SEO metadata.
7. Writes `wordpress_post_id`, `wordpress_draft_url`, `upload_status`, and `last_processed_at` back to the sheet.
8. Appends a row to `Upload Log`.

If a row already has a `wordpress_post_id`, the tool should warn before creating another post. This prevents accidental duplicate drafts.

### 10.2 Update Existing

For `upload_action = update_existing`, the tool:

1. Requires `wordpress_post_id`.
2. Fetches the existing WordPress post.
3. Reads and converts the Google Doc after the marker.
4. Resolves or creates taxonomy terms.
5. Uploads or updates the featured image if provided.
6. Updates title, slug, content, category, tags, featured image, and Yoast meta.
7. Preserves the existing WordPress post status.
8. Writes `upload_status = updated`, `last_processed_at`, and notes back to the sheet.
9. Appends a row to `Upload Log`.

If the existing post is already published, changes may go live immediately. `Validate/Preview` exists to reduce this risk.

## 11. Taxonomy Behavior

Category handling:

- `parent_category` and `child_category` are read from the sheet.
- The tool searches WordPress categories by name or slug.
- If the parent category does not exist and site config allows creation, create it.
- If the child category does not exist and site config allows creation, create it with the parent category ID.
- Attach the child category to the post.
- Optionally attach the parent category too if the site requires it; this should be configurable per site.

Tag handling:

- Split `tags` by comma.
- Trim whitespace.
- Search or create tags in WordPress.
- Attach all tag IDs to the post.

Rubrik handling:

- Default MVP behavior: write `rubrik` as custom field/meta.
- Per-site config can later map rubrik to category or tag.

## 12. Yoast SEO Metadata

The tool writes:

- `meta_title` to `_yoast_wpseo_title`
- `meta_description` to `_yoast_wpseo_metadesc`

If a WordPress site does not allow these meta keys to be updated through the REST API, the tool should fail clearly with a configuration error. It should not silently report success.

The implementation may require registering Yoast meta keys in WordPress, using a helper plugin, or enabling REST exposure for the needed fields. That site-specific setup should be documented during implementation.

## 13. Featured Image Behavior

The tool reads `featured_image_url`.

Rules:

- URL must be publicly accessible.
- Apps Script downloads the image.
- Apps Script uploads it to `/wp-json/wp/v2/media`.
- The returned media ID is assigned as `featured_media`.
- If image upload fails during preview, write a warning.
- If image upload fails during upload, the post can still be created/updated if content is valid, but `upload_status` should become `warning` and `validation_notes` or `error_notes` should explain the image issue.

## 14. Access Control

Before validation or upload:

1. Get the active user's email.
2. Check `Authorized Users`.
3. Continue only if the user has an active row.

Unauthorized users can still view the spreadsheet if sharing permissions allow it, but cannot run the uploader menu successfully.

## 15. Run Control

The tool should use Apps Script locking to avoid two upload runs at the same time.

Recommended behavior:

- If another run is active, stop and show a clear message.
- Generate a `run_id` for each preview/upload.
- Log each processed row with the same `run_id`.

The user can schedule the script manually later through Apps Script triggers or another scheduler. The tool itself should be idempotent enough to run repeatedly without duplicate creation.

## 16. Upload Status Values

Suggested `upload_status` values:

- `pending`
- `validated`
- `uploaded`
- `updated`
- `warning`
- `error`
- `skipped`

The uploader should not overwrite editorial `status`.

## 17. Validation Rules

Blocking validation errors:

- Unauthorized user.
- Missing site config.
- Missing WordPress credentials.
- Unsupported `upload_action`.
- `create_draft` without `post_title`.
- `create_draft` without `google_doc_url`.
- `create_draft` where Google Doc marker is missing.
- `update_existing` without `wordpress_post_id`.
- `update_existing` where target post cannot be found.
- Missing required category fields if the site requires categories.
- Google Doc cannot be read.

Non-blocking warnings:

- Meta title too short or too long.
- Meta description too short or too long.
- Featured image URL missing if image is optional.
- Featured image upload failed but post content was valid.
- Tags not found but created automatically.
- Category not found but created automatically.

## 18. Sample Content Row

```text
upload_action: create_draft
status: drafted
article_type: new article
rubrik: konsep pelajaran
pic: Nama PIC
post_title: Perbedaan Teks Eksplanasi dan Teks Eksposisi
slug: perbedaan-teks-eksplanasi-dan-teks-eksposisi
google_doc_url: https://docs.google.com/document/d/...
parent_category: Bahasa Indonesia
child_category: Bahasa Indonesia SMP Kelas 8
tags: kelas 8, konsep pelajaran, smp
featured_image_url: https://example.com/image.jpg
meta_title: Perbedaan Teks Eksplanasi dan Eksposisi
meta_description: Cari tahu perbedaan teks eksplanasi dan teks eksposisi, lengkap dengan ciri-ciri, struktur, dan contohnya untuk materi Bahasa Indonesia.
```

## 19. Testing Plan

Test cases:

- Run `Setup Template` on an empty spreadsheet.
- Run `Setup Template` on an existing spreadsheet and verify it does not destroy user content.
- Validate as an authorized user.
- Validate as an unauthorized user.
- Preview a valid `create_draft` row.
- Preview a Google Doc without the WordPress content marker.
- Create a draft post with category, tags, Yoast meta, and featured image.
- Create a draft post with a missing optional featured image.
- Update an existing draft post by `wordpress_post_id`.
- Update an existing published post and verify WordPress status is preserved.
- Verify meta title and description warnings are shown but do not block upload.
- Verify parent/child category creation.
- Verify tag creation from comma-separated input.
- Verify `Upload Current Site` processes only the active tab.
- Verify `Upload All Sites` processes active site tabs.
- Rerun upload on a created row and confirm it does not create a duplicate post without warning.
- Verify every processed row writes to `Upload Log`.

## 20. Implementation Decisions

- Use Google Docs export HTML as the preferred content conversion path because it preserves headings, links, basic lists, bold, and italic more naturally than manual paragraph traversal.
- Keep a fallback parser based on `DocumentApp` only if export HTML cannot reliably isolate content after the marker.
- Treat Yoast REST write support as a site readiness check. If the site cannot accept `_yoast_wpseo_title` or `_yoast_wpseo_metadesc`, preview should show a configuration warning before upload.
- Treat WordPress taxonomy creation permission as a site readiness check. If the authenticated user cannot create categories or tags, upload should stop for rows that require missing terms.
- Generate WordPress edit/draft links from the configured admin URL pattern for each site, with a default of `/wp-admin/post.php?post={id}&action=edit`.
