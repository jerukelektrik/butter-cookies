# Manual QA Checklist

## Spreadsheet Setup

- Open the bound Google Spreadsheet.
- Run `WP Content Uploader > Setup Template`.
- Confirm `Sites`, `Authorized Users`, `Taxonomy Config`, and `Upload Log` exist.
- Confirm active site tabs exist.
- Confirm content tabs have frozen headers.
- Confirm dropdowns exist for `upload_action`, `status`, `article_type`, and `rubrik`.
- Confirm meta title and meta description warning cells turn red when values are outside target length.

## Authorization

- Run preview as an authorized email and confirm it proceeds.
- Run preview as an unauthorized email and confirm it stops with an unauthorized user message.

## Preview

- Add a `create_draft` row with a Google Doc containing `=== START WORDPRESS CONTENT ===`.
- Run `Validate/Preview Current Site`.
- Confirm WordPress is not changed.
- Confirm `validation_notes`, `error_notes`, and `last_processed_at` update.

## Create Draft

- Run `Upload Current Site` for one valid `create_draft` row.
- Confirm WordPress creates a draft post.
- Confirm categories, tags, rubrik meta, Yoast title, Yoast description, and featured image are present.
- Confirm `wordpress_post_id`, `wordpress_draft_url`, `upload_status`, and `last_processed_at` update.
- Confirm `Upload Log` receives a row.

## Update Existing

- Use a known `wordpress_post_id`.
- Run preview first.
- Run upload.
- Confirm the post content updates.
- Confirm the original WordPress post status is preserved.
- Confirm `Upload Log` receives a row.
