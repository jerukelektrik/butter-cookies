# Butter Cookies

Google Sheets and Google Apps Script tool for uploading reviewed content plans to WordPress.

## Current Status

This repository contains a Google Apps Script implementation for a multi-site WordPress content plan uploader, plus local Node tests for the pure logic modules.

Read the design spec:

- `docs/superpowers/specs/2026-06-17-wordpress-content-plan-uploader-design.md`

## Planned Scope

- Google Sheets menu for setup, validation, preview, and upload.
- One content tab per WordPress website.
- Google Docs as the reviewed article source.
- WordPress REST API upload for new drafts and existing post updates.
- Featured image upload from public URLs.
- Parent category, child category, tags, rubrik, PIC, slug, and Yoast SEO metadata.
- Apps Script Properties for WordPress credentials.
- Authorized user checks and upload logging.

## Local Development

Run pure logic tests locally with Node:

```bash
npm test
```

Build the paste-ready Apps Script bundle:

```bash
npm run build:gas
```

The Apps Script files live in `src/`. Files are written as ES modules so pure functions can be tested locally, then copied into Apps Script with compatible exports during deployment.

## Apps Script Deployment

The source files are organized as ES modules for local tests. For Apps Script deployment, generate a V8-compatible bundle so globals from `src/Code.js` are available as menu callbacks.

```bash
npm run build:gas
```

Then install it in a test spreadsheet:

1. Open a Google Sheet.
2. Go to **Extensions > Apps Script**.
3. Delete the default code.
4. Paste the contents of `apps-script/Code.gs`.
5. Open **Project Settings** and ensure the manifest is visible.
6. Replace the manifest with `apps-script/appsscript.json`.
7. Save the Apps Script project.
8. Reload the spreadsheet.
9. Confirm the `WP Content Uploader` menu appears.

On first run, Google will show an authorization screen. For an internal unverified script, choose **Advanced > Go to project > Allow**.

Required project properties per site:

```text
WP_<SITE_KEY>_USERNAME
WP_<SITE_KEY>_APP_PASSWORD
```

For `site_key = ruangguru`, use:

```text
WP_RUANGGURU_USERNAME
WP_RUANGGURU_APP_PASSWORD
```

Set those in Apps Script through **Project Settings > Script Properties**.

## Operating Model

1. Keep writer briefs, review notes, and keyword tables above this marker in each Google Doc:

```text
=== START WORDPRESS CONTENT ===
```

2. Put only final article content below the marker.
3. Use `upload_action = create_draft` for new WordPress drafts.
4. Use `upload_action = update_existing` only when `wordpress_post_id` points to the correct post.
5. Run `Validate/Preview Current Site` before upload.
6. Run `Upload Current Site` for focused work, or `Upload All Sites` when all active tabs are ready.

## Safety Notes

- `status` is editorial and is not overwritten by the uploader.
- `update_existing` preserves WordPress post status. If the target post is published, content changes can go live immediately.
- WordPress credentials stay in Apps Script Properties, not in the spreadsheet.
