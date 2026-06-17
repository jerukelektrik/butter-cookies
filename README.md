# Butter Cookies

Google Sheets and Google Apps Script tool for uploading reviewed content plans to WordPress.

## Current Status

This repository currently contains the approved design draft for a multi-site WordPress content plan uploader. Implementation has not started yet.

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

The Apps Script files live in `src/`. Files are written as ES modules so pure functions can be tested locally, then copied into Apps Script with compatible exports during deployment.

## Apps Script Deployment

The source files are organized as ES modules for local tests. For Apps Script deployment, bundle or copy the modules into a V8-compatible Apps Script project so globals from `src/Code.js` are available as menu callbacks.

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
