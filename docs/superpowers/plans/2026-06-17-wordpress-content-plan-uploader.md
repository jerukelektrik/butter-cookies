# WordPress Content Plan Uploader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a Google Apps Script project that prepares a multi-site Google Sheets content plan and uploads reviewed Google Docs articles to WordPress.

**Architecture:** Use a small, testable Apps Script codebase split by responsibility: constants, spreadsheet setup, row parsing, validation, Google Doc conversion, WordPress API, upload orchestration, and menu entrypoints. Keep pure logic in files that can be unit-tested locally with Node, and keep Apps Script service calls behind thin adapters.

**Tech Stack:** Google Apps Script JavaScript, Google Sheets, Google Docs export HTML, WordPress REST API, Yoast SEO REST meta, Node.js test runner for pure modules.

---

## File Structure

- Create `appsscript.json`: Apps Script manifest with Sheets and external request scopes.
- Create `src/Code.js`: global Apps Script menu functions and entrypoints.
- Create `src/constants.js`: sheet names, headers, enums, marker text, meta limits, property keys.
- Create `src/sheets.js`: sheet setup, header lookup, row reading/writing, dropdowns, formulas, conditional formatting, logs.
- Create `src/auth.js`: authorized user checks and script property credential lookup.
- Create `src/validation.js`: row-level validation and warning generation.
- Create `src/docs.js`: Google Doc URL parsing, export HTML fetching, marker slicing, HTML cleanup.
- Create `src/wordpress.js`: WordPress REST client, taxonomy resolution, media upload, post create/update, Yoast meta checks.
- Create `src/uploader.js`: orchestration for preview/upload current site and all sites.
- Create `test/constants.test.mjs`: enum/header smoke tests.
- Create `test/validation.test.mjs`: validation behavior tests.
- Create `test/docs.test.mjs`: marker slicing and HTML cleanup tests.
- Create `test/sheets.test.mjs`: row mapping and formula generation tests.
- Create `test/wordpress.test.mjs`: REST payload and auth header tests using fake fetch.
- Create `package.json`: local test scripts.
- Create `.gitignore`: ignore dependencies and Apps Script local files that should not be committed.
- Modify `README.md`: add setup, test, deployment, credentials, and operating instructions.

## Task 1: Project Skeleton And Shared Constants

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `appsscript.json`
- Create: `src/constants.js`
- Create: `test/constants.test.mjs`
- Modify: `README.md`

- [x] **Step 1: Add local Node test setup**

Create `package.json`:

```json
{
  "name": "butter-cookies",
  "version": "0.1.0",
  "private": true,
  "description": "Google Sheets and Apps Script WordPress content plan uploader.",
  "type": "module",
  "scripts": {
    "test": "node --test test/*.test.mjs",
    "test:watch": "node --test --watch test/*.test.mjs"
  },
  "engines": {
    "node": ">=20"
  }
}
```

Create `.gitignore`:

```gitignore
node_modules/
.clasp.json
.clasprc.json
dist/
.DS_Store
```

- [x] **Step 2: Add Apps Script manifest**

Create `appsscript.json`:

```json
{
  "timeZone": "Asia/Jakarta",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets.currentonly",
    "https://www.googleapis.com/auth/documents.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/script.scriptapp"
  ]
}
```

- [x] **Step 3: Write constants test first**

Create `test/constants.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTENT_MARKER,
  CONTENT_HEADERS,
  META_LIMITS,
  UPLOAD_ACTIONS,
  EDITORIAL_STATUSES,
  ARTICLE_TYPES,
} from '../src/constants.js';

test('content marker is explicit and stable', () => {
  assert.equal(CONTENT_MARKER, '=== START WORDPRESS CONTENT ===');
});

test('content headers include operational and WordPress result columns', () => {
  assert.ok(CONTENT_HEADERS.includes('upload_action'));
  assert.ok(CONTENT_HEADERS.includes('google_doc_url'));
  assert.ok(CONTENT_HEADERS.includes('wordpress_post_id'));
  assert.ok(CONTENT_HEADERS.includes('last_processed_at'));
});

test('allowed workflow enums match the design spec', () => {
  assert.deepEqual(UPLOAD_ACTIONS, ['create_draft', 'update_existing', 'skip']);
  assert.deepEqual(EDITORIAL_STATUSES, ['publish', 'schedule', 'drafted', 'update']);
  assert.deepEqual(ARTICLE_TYPES, ['new article', 'rework', 'LHF', 'Low CTR', 'Lost Keywords']);
});

test('SEO meta limits match the approved ranges', () => {
  assert.deepEqual(META_LIMITS.title, { min: 55, max: 62 });
  assert.deepEqual(META_LIMITS.description, { min: 155, max: 162 });
});
```

- [x] **Step 4: Run test to verify it fails**

Run:

```bash
npm test
```

Expected: FAIL because `src/constants.js` does not exist.

- [x] **Step 5: Add constants implementation**

Create `src/constants.js`:

```js
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
```

- [x] **Step 6: Run test to verify it passes**

Run:

```bash
npm test
```

Expected: PASS for all constants tests.

- [x] **Step 7: Update README with local test command**

Add this section to `README.md`:

````markdown
## Local Development

Run pure logic tests locally with Node:

```bash
npm test
```

The Apps Script files live in `src/`. Files are written as ES modules so pure functions can be tested locally, then copied into Apps Script with compatible exports during deployment.
````

- [x] **Step 8: Commit**

Run:

```bash
git add package.json .gitignore appsscript.json src/constants.js test/constants.test.mjs README.md
git commit -m "chore: add Apps Script project skeleton"
```

Expected: commit succeeds.

## Task 2: Spreadsheet Setup And Row Mapping

**Files:**
- Create: `src/sheets.js`
- Create: `test/sheets.test.mjs`
- Modify: `src/constants.js`

- [x] **Step 1: Write tests for header mapping and formulas**

Create `test/sheets.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHeaderMap,
  mapRowToObject,
  buildMetaLengthFormula,
  buildMetaCheckFormula,
  normalizeBoolean,
} from '../src/sheets.js';

test('buildHeaderMap maps headers to zero-based indexes', () => {
  assert.deepEqual(buildHeaderMap(['site_key', 'active']), { site_key: 0, active: 1 });
});

test('mapRowToObject trims string values and keeps numbers', () => {
  const result = mapRowToObject(['post_title', 'wordpress_post_id'], [' Judul ', 123]);
  assert.deepEqual(result, { post_title: 'Judul', wordpress_post_id: 123 });
});

test('normalizeBoolean handles sheet-like truthy values', () => {
  assert.equal(normalizeBoolean(true), true);
  assert.equal(normalizeBoolean('TRUE'), true);
  assert.equal(normalizeBoolean('yes'), true);
  assert.equal(normalizeBoolean('1'), true);
  assert.equal(normalizeBoolean('FALSE'), false);
});

test('buildMetaLengthFormula counts a source cell', () => {
  assert.equal(buildMetaLengthFormula('M2'), '=LEN(M2)');
});

test('buildMetaCheckFormula creates title warning formula', () => {
  assert.equal(
    buildMetaCheckFormula('N2', 'title'),
    '=IF(N2="","",IF(N2<55,"meta title too short",IF(N2>62,"meta title too long","")))'
  );
});

test('buildMetaCheckFormula creates description warning formula', () => {
  assert.equal(
    buildMetaCheckFormula('Q2', 'description'),
    '=IF(Q2="","",IF(Q2<155,"meta description too short",IF(Q2>162,"meta description too long","")))'
  );
});
```

- [x] **Step 2: Run tests to verify failure**

Run:

```bash
npm test
```

Expected: FAIL because `src/sheets.js` does not exist.

- [x] **Step 3: Implement pure sheet helpers**

Create `src/sheets.js`:

```js
import {
  AUTHORIZED_USER_HEADERS,
  CONTENT_HEADERS,
  DEFAULT_RUBRIKS,
  EDITORIAL_STATUSES,
  META_LIMITS,
  SHEET_NAMES,
  SITE_HEADERS,
  TAXONOMY_HEADERS,
  UPLOAD_ACTIONS,
  UPLOAD_LOG_HEADERS,
  ARTICLE_TYPES,
} from './constants.js';

export function buildHeaderMap(headers) {
  return headers.reduce((map, header, index) => {
    const key = String(header || '').trim();
    if (key) map[key] = index;
    return map;
  }, {});
}

export function mapRowToObject(headers, row) {
  return headers.reduce((record, header, index) => {
    const value = row[index];
    record[header] = typeof value === 'string' ? value.trim() : value;
    return record;
  }, {});
}

export function normalizeBoolean(value) {
  if (value === true) return true;
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'true' || normalized === 'yes' || normalized === '1';
}

export function buildMetaLengthFormula(sourceCell) {
  return `=LEN(${sourceCell})`;
}

export function buildMetaCheckFormula(lengthCell, kind) {
  const limits = kind === 'title' ? META_LIMITS.title : META_LIMITS.description;
  const label = kind === 'title' ? 'meta title' : 'meta description';
  return `=IF(${lengthCell}="","",IF(${lengthCell}<${limits.min},"${label} too short",IF(${lengthCell}>${limits.max},"${label} too long","")))`;
}

export function ensureSheet(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

export function ensureHeaders(sheet, headers) {
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

export function setupSharedSheets(spreadsheet) {
  ensureHeaders(ensureSheet(spreadsheet, SHEET_NAMES.sites), SITE_HEADERS);
  ensureHeaders(ensureSheet(spreadsheet, SHEET_NAMES.authorizedUsers), AUTHORIZED_USER_HEADERS);
  ensureHeaders(ensureSheet(spreadsheet, SHEET_NAMES.taxonomyConfig), TAXONOMY_HEADERS);
  ensureHeaders(ensureSheet(spreadsheet, SHEET_NAMES.uploadLog), UPLOAD_LOG_HEADERS);
}

export function setupContentSheet(sheet) {
  ensureHeaders(sheet, CONTENT_HEADERS);
  applyContentDataValidation(sheet);
  applyMetaFormulas(sheet);
  applyMetaConditionalFormatting(sheet);
}

export function applyContentDataValidation(sheet) {
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
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
    sheet.getRange(2, column, maxRows, 1).setDataValidation(rule);
  });
}

export function applyMetaFormulas(sheet) {
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
    sheet.getRange(row, headerMap.meta_description_check + 1).setFormula(buildMetaCheckFormula(descLengthCell, 'description'));
  }
}

export function applyMetaConditionalFormatting(sheet) {
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
```

- [x] **Step 4: Run tests to verify pass**

Run:

```bash
npm test
```

Expected: PASS.

- [x] **Step 5: Commit**

Run:

```bash
git add src/sheets.js test/sheets.test.mjs src/constants.js
git commit -m "feat: add spreadsheet setup helpers"
```

Expected: commit succeeds.

## Task 3: Authorization And Credential Lookup

**Files:**
- Create: `src/auth.js`
- Create: `test/auth.test.mjs`
- Modify: `src/constants.js`

- [x] **Step 1: Write authorization tests**

Create `test/auth.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { findAuthorizedUser, getCredentialPropertyKeys, maskCredentialStatus } from '../src/auth.js';

test('findAuthorizedUser returns active matching user case-insensitively', () => {
  const users = [
    { email: 'editor@example.com', active: 'FALSE' },
    { email: 'Owner@Example.com', active: 'TRUE' },
  ];
  assert.deepEqual(findAuthorizedUser(users, 'owner@example.com'), { email: 'Owner@Example.com', active: 'TRUE' });
});

test('findAuthorizedUser returns null for inactive or missing users', () => {
  assert.equal(findAuthorizedUser([{ email: 'a@example.com', active: 'FALSE' }], 'a@example.com'), null);
  assert.equal(findAuthorizedUser([], 'a@example.com'), null);
});

test('credential property keys are normalized per site', () => {
  assert.deepEqual(getCredentialPropertyKeys('ruang guru'), {
    usernameKey: 'WP_RUANG_GURU_USERNAME',
    passwordKey: 'WP_RUANG_GURU_APP_PASSWORD',
  });
});

test('maskCredentialStatus reports missing keys without leaking values', () => {
  assert.deepEqual(maskCredentialStatus({ username: 'admin', appPassword: '' }), {
    hasUsername: true,
    hasAppPassword: false,
  });
});
```

- [x] **Step 2: Run tests to verify failure**

Run:

```bash
npm test
```

Expected: FAIL because `src/auth.js` does not exist.

- [x] **Step 3: Implement authorization helpers**

Create `src/auth.js`:

```js
import { propertyKeyForSite } from './constants.js';
import { normalizeBoolean } from './sheets.js';

export function findAuthorizedUser(users, email) {
  const target = String(email || '').trim().toLowerCase();
  if (!target) return null;
  return users.find((user) => String(user.email || '').trim().toLowerCase() === target && normalizeBoolean(user.active)) || null;
}

export function getCredentialPropertyKeys(siteKey) {
  return {
    usernameKey: propertyKeyForSite(siteKey, 'USERNAME'),
    passwordKey: propertyKeyForSite(siteKey, 'APP_PASSWORD'),
  };
}

export function readWordPressCredentials(siteKey, properties) {
  const { usernameKey, passwordKey } = getCredentialPropertyKeys(siteKey);
  return {
    username: properties.getProperty(usernameKey) || '',
    appPassword: properties.getProperty(passwordKey) || '',
  };
}

export function maskCredentialStatus(credentials) {
  return {
    hasUsername: Boolean(credentials.username),
    hasAppPassword: Boolean(credentials.appPassword),
  };
}

export function assertAuthorizedUser(users, email) {
  const user = findAuthorizedUser(users, email);
  if (!user) {
    throw new Error(`Unauthorized user: ${email || 'unknown'}`);
  }
  return user;
}
```

- [x] **Step 4: Run tests to verify pass**

Run:

```bash
npm test
```

Expected: PASS.

- [x] **Step 5: Commit**

Run:

```bash
git add src/auth.js test/auth.test.mjs
git commit -m "feat: add authorization and credential helpers"
```

Expected: commit succeeds.

## Task 4: Row Validation

**Files:**
- Create: `src/validation.js`
- Create: `test/validation.test.mjs`

- [x] **Step 1: Write validation tests**

Create `test/validation.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContentRow, splitTags, metaWarnings } from '../src/validation.js';

const baseContext = {
  site: { site_key: 'ruangguru', wordpress_base_url: 'https://example.com', active: 'TRUE' },
  credentials: { username: 'admin', appPassword: 'secret' },
  docHasMarker: true,
};

test('splitTags trims comma-separated tags', () => {
  assert.deepEqual(splitTags('kelas 12, konsep pelajaran, sma'), ['kelas 12', 'konsep pelajaran', 'sma']);
});

test('metaWarnings returns non-blocking SEO messages', () => {
  assert.deepEqual(metaWarnings({ meta_title: 'Pendek', meta_description: 'Singkat' }), [
    'meta title too short',
    'meta description too short',
  ]);
});

test('validateContentRow skips skip action', () => {
  const result = validateContentRow({ upload_action: 'skip' }, baseContext);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, ['row skipped by upload_action']);
  assert.equal(result.shouldProcess, false);
});

test('create_draft requires title, doc, marker, and categories', () => {
  const result = validateContentRow({ upload_action: 'create_draft' }, { ...baseContext, docHasMarker: false });
  assert.deepEqual(result.errors, [
    'post_title is required for create_draft',
    'google_doc_url is required',
    'Google Doc marker is missing',
    'parent_category is required',
    'child_category is required',
  ]);
});

test('update_existing requires wordpress_post_id', () => {
  const result = validateContentRow(
    {
      upload_action: 'update_existing',
      post_title: 'Judul',
      google_doc_url: 'https://docs.google.com/document/d/abc/edit',
      parent_category: 'Bahasa Indonesia',
      child_category: 'Bahasa Indonesia SMP',
    },
    baseContext
  );
  assert.deepEqual(result.errors, ['wordpress_post_id is required for update_existing']);
});

test('valid create_draft can process with SEO warnings', () => {
  const result = validateContentRow(
    {
      upload_action: 'create_draft',
      post_title: 'Judul',
      google_doc_url: 'https://docs.google.com/document/d/abc/edit',
      parent_category: 'Bahasa Indonesia',
      child_category: 'Bahasa Indonesia SMP',
      meta_title: 'Judul',
      meta_description: 'Deskripsi pendek',
    },
    baseContext
  );
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.includes('meta title too short'));
  assert.ok(result.warnings.includes('meta description too short'));
  assert.equal(result.shouldProcess, true);
});
```

- [x] **Step 2: Run tests to verify failure**

Run:

```bash
npm test
```

Expected: FAIL because `src/validation.js` does not exist.

- [x] **Step 3: Implement validation logic**

Create `src/validation.js`:

```js
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
  if (descriptionLength > 0 && descriptionLength < META_LIMITS.description.min) warnings.push('meta description too short');
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
```

- [x] **Step 4: Run tests to verify pass**

Run:

```bash
npm test
```

Expected: PASS.

- [x] **Step 5: Commit**

Run:

```bash
git add src/validation.js test/validation.test.mjs
git commit -m "feat: add content row validation"
```

Expected: commit succeeds.

## Task 5: Google Doc HTML Extraction

**Files:**
- Create: `src/docs.js`
- Create: `test/docs.test.mjs`

- [x] **Step 1: Write Google Doc extraction tests**

Create `test/docs.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractGoogleDocId, sliceAfterMarker, cleanExportedHtml } from '../src/docs.js';

test('extractGoogleDocId handles standard Google Docs URLs', () => {
  assert.equal(
    extractGoogleDocId('https://docs.google.com/document/d/abc123DEF456/edit'),
    'abc123DEF456'
  );
});

test('extractGoogleDocId handles raw document IDs', () => {
  assert.equal(extractGoogleDocId('abc123DEF456'), 'abc123DEF456');
});

test('sliceAfterMarker returns content after marker only', () => {
  const html = '<p>Brief</p><p>=== START WORDPRESS CONTENT ===</p><h1>Judul</h1><p>Isi</p>';
  assert.equal(sliceAfterMarker(html).html, '<h1>Judul</h1><p>Isi</p>');
  assert.equal(sliceAfterMarker(html).hasMarker, true);
});

test('sliceAfterMarker reports missing marker', () => {
  const result = sliceAfterMarker('<h1>Judul</h1>');
  assert.equal(result.html, '');
  assert.equal(result.hasMarker, false);
});

test('cleanExportedHtml removes scripts, styles, and Google wrapper noise', () => {
  const dirty = '<html><head><style>.x{}</style><script>x()</script></head><body><h1 class="c1">Judul</h1><p>Isi</p></body></html>';
  assert.equal(cleanExportedHtml(dirty), '<h1>Judul</h1><p>Isi</p>');
});
```

- [x] **Step 2: Run tests to verify failure**

Run:

```bash
npm test
```

Expected: FAIL because `src/docs.js` does not exist.

- [x] **Step 3: Implement document helpers**

Create `src/docs.js`:

```js
import { CONTENT_MARKER } from './constants.js';

export function extractGoogleDocId(value) {
  const input = String(value || '').trim();
  const match = input.match(/\/document\/d\/([^/]+)/);
  if (match) return match[1];
  if (/^[A-Za-z0-9_-]+$/.test(input)) return input;
  throw new Error(`Invalid Google Doc URL: ${input}`);
}

export function sliceAfterMarker(html) {
  const markerIndex = String(html || '').indexOf(CONTENT_MARKER);
  if (markerIndex === -1) return { html: '', hasMarker: false };
  const afterMarker = html.slice(markerIndex + CONTENT_MARKER.length);
  const withoutMarkerParagraph = afterMarker.replace(/^(\s|<\/?p[^>]*>|<br\s*\/?>|&nbsp;)*/i, '');
  return { html: withoutMarkerParagraph.trim(), hasMarker: true };
}

export function cleanExportedHtml(html) {
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

export function fetchGoogleDocExportHtml(docUrl, fetcher = UrlFetchApp.fetch) {
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
```

- [x] **Step 4: Run tests to verify pass**

Run:

```bash
npm test
```

Expected: PASS.

- [x] **Step 5: Commit**

Run:

```bash
git add src/docs.js test/docs.test.mjs
git commit -m "feat: add Google Doc content extraction"
```

Expected: commit succeeds.

## Task 6: WordPress REST Client

**Files:**
- Create: `src/wordpress.js`
- Create: `test/wordpress.test.mjs`

- [x] **Step 1: Write WordPress client tests**

Create `test/wordpress.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBasicAuthHeader,
  buildPostPayload,
  buildEditUrl,
  normalizeBaseUrl,
} from '../src/wordpress.js';

test('buildBasicAuthHeader creates Basic auth header', () => {
  assert.equal(buildBasicAuthHeader('admin', 'app pass'), `Basic ${Buffer.from('admin:app pass').toString('base64')}`);
});

test('normalizeBaseUrl removes trailing slash', () => {
  assert.equal(normalizeBaseUrl('https://example.com/'), 'https://example.com');
});

test('buildPostPayload maps row and resolved taxonomy to REST payload', () => {
  const payload = buildPostPayload(
    {
      post_title: 'Judul',
      slug: 'judul-artikel',
      rubrik: 'konsep pelajaran',
      meta_title: 'Meta Title',
      meta_description: 'Meta Description',
    },
    {
      html: '<h1>Judul</h1><p>Isi</p>',
      categoryIds: [11, 12],
      tagIds: [21, 22],
      featuredMediaId: 44,
      status: 'draft',
    }
  );
  assert.deepEqual(payload, {
    title: 'Judul',
    slug: 'judul-artikel',
    content: '<h1>Judul</h1><p>Isi</p>',
    categories: [11, 12],
    tags: [21, 22],
    featured_media: 44,
    status: 'draft',
    meta: {
      rubrik: 'konsep pelajaran',
      _yoast_wpseo_title: 'Meta Title',
      _yoast_wpseo_metadesc: 'Meta Description',
    },
  });
});

test('buildPostPayload can omit status for update_existing', () => {
  const payload = buildPostPayload({ post_title: 'Judul' }, { html: '<p>Isi</p>', categoryIds: [], tagIds: [] });
  assert.equal(Object.hasOwn(payload, 'status'), false);
});

test('buildEditUrl uses configured pattern or default wp-admin pattern', () => {
  assert.equal(buildEditUrl({ wordpress_base_url: 'https://example.com' }, 123), 'https://example.com/wp-admin/post.php?post=123&action=edit');
  assert.equal(
    buildEditUrl({ wordpress_base_url: 'https://example.com', admin_url_pattern: '/admin/edit/{id}' }, 123),
    'https://example.com/admin/edit/123'
  );
});
```

- [x] **Step 2: Run tests to verify failure**

Run:

```bash
npm test
```

Expected: FAIL because `src/wordpress.js` does not exist.

- [x] **Step 3: Implement WordPress payload helpers and client shell**

Create `src/wordpress.js`:

```js
export function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function buildBasicAuthHeader(username, appPassword) {
  const raw = `${username}:${appPassword}`;
  if (typeof Buffer !== 'undefined') {
    return `Basic ${Buffer.from(raw).toString('base64')}`;
  }
  return `Basic ${Utilities.base64Encode(raw)}`;
}

export function buildPostPayload(row, options) {
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

export function buildEditUrl(site, postId) {
  const baseUrl = normalizeBaseUrl(site.wordpress_base_url);
  const pattern = site.admin_url_pattern || '/wp-admin/post.php?post={id}&action=edit';
  return `${baseUrl}${pattern.replace('{id}', encodeURIComponent(postId))}`;
}

export class WordPressClient {
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
}
```

- [x] **Step 4: Run tests to verify pass**

Run:

```bash
npm test
```

Expected: PASS.

- [x] **Step 5: Commit**

Run:

```bash
git add src/wordpress.js test/wordpress.test.mjs
git commit -m "feat: add WordPress REST payload helpers"
```

Expected: commit succeeds.

## Task 7: Upload Orchestration

**Files:**
- Create: `src/uploader.js`
- Create: `test/uploader.test.mjs`
- Modify: `src/wordpress.js`
- Modify: `src/sheets.js`

- [x] **Step 1: Write orchestration tests**

Create `test/uploader.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { processContentRow } from '../src/uploader.js';

function fakeDependencies(overrides = {}) {
  return {
    fetchDocHtml: () => ({ hasMarker: true, html: '<h1>Judul</h1><p>Isi</p>' }),
    resolveTaxonomy: () => ({ categoryIds: [1, 2], tagIds: [3] }),
    uploadFeaturedImage: () => 10,
    createPost: () => ({ id: 99 }),
    updatePost: () => ({ id: 88 }),
    getPost: () => ({ id: 88, status: 'publish' }),
    buildEditUrl: (_site, id) => `https://example.com/wp-admin/post.php?post=${id}&action=edit`,
    ...overrides,
  };
}

test('processContentRow creates a draft for create_draft', () => {
  const result = processContentRow(
    {
      upload_action: 'create_draft',
      post_title: 'Judul',
      google_doc_url: 'https://docs.google.com/document/d/abc/edit',
      parent_category: 'Bahasa',
      child_category: 'Bahasa SD',
      tags: 'kelas 4',
    },
    { site: { wordpress_base_url: 'https://example.com' }, credentials: { username: 'u', appPassword: 'p' } },
    fakeDependencies()
  );
  assert.equal(result.status, 'uploaded');
  assert.equal(result.wordpress_post_id, 99);
  assert.match(result.wordpress_draft_url, /post=99/);
});

test('processContentRow updates an existing post without sending status', () => {
  let updatePayload;
  const result = processContentRow(
    {
      upload_action: 'update_existing',
      wordpress_post_id: 88,
      post_title: 'Judul',
      google_doc_url: 'https://docs.google.com/document/d/abc/edit',
      parent_category: 'Bahasa',
      child_category: 'Bahasa SD',
      tags: 'kelas 4',
    },
    { site: { wordpress_base_url: 'https://example.com' }, credentials: { username: 'u', appPassword: 'p' } },
    fakeDependencies({
      updatePost: (_id, payload) => {
        updatePayload = payload;
        return { id: 88 };
      },
    })
  );
  assert.equal(result.status, 'updated');
  assert.equal(Object.hasOwn(updatePayload, 'status'), false);
});

test('processContentRow returns error for missing marker', () => {
  const result = processContentRow(
    {
      upload_action: 'create_draft',
      post_title: 'Judul',
      google_doc_url: 'https://docs.google.com/document/d/abc/edit',
      parent_category: 'Bahasa',
      child_category: 'Bahasa SD',
    },
    { site: { wordpress_base_url: 'https://example.com' }, credentials: { username: 'u', appPassword: 'p' } },
    fakeDependencies({ fetchDocHtml: () => ({ hasMarker: false, html: '' }) })
  );
  assert.equal(result.status, 'error');
  assert.match(result.error_notes, /Google Doc marker is missing/);
});
```

- [x] **Step 2: Run tests to verify failure**

Run:

```bash
npm test
```

Expected: FAIL because `src/uploader.js` does not exist.

- [x] **Step 3: Implement orchestration**

Create `src/uploader.js`:

```js
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
```

Then add this import at the top of `src/uploader.js`:

```js
import { fetchGoogleDocExportHtml } from './docs.js';
```

- [x] **Step 4: Run tests to verify pass**

Run:

```bash
npm test
```

Expected: PASS.

- [x] **Step 5: Commit**

Run:

```bash
git add src/uploader.js test/uploader.test.mjs
git commit -m "feat: add upload orchestration"
```

Expected: commit succeeds.

## Task 8: Apps Script Entrypoints And Menus

**Files:**
- Create: `src/Code.js`
- Modify: `src/sheets.js`
- Modify: `src/uploader.js`
- Modify: `README.md`

- [x] **Step 1: Add global menu entrypoints**

Create `src/Code.js`:

```js
import { SHEET_NAMES } from './constants.js';
import { setupSharedSheets, setupContentSheet } from './sheets.js';
import { runUploadForActiveSheet, runUploadForAllSites, runPreviewForActiveSheet, runPreviewForAllSites } from './uploader.js';

export function onOpen() {
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

export function setupTemplate() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  setupSharedSheets(spreadsheet);
  const sitesSheet = spreadsheet.getSheetByName(SHEET_NAMES.sites);
  const values = sitesSheet.getDataRange().getValues();
  const headers = values[0];
  const siteKeyIndex = headers.indexOf('site_key');
  const activeIndex = headers.indexOf('active');
  values.slice(1).forEach((row) => {
    const siteKey = String(row[siteKeyIndex] || '').trim();
    const active = String(row[activeIndex] || '').trim().toUpperCase() === 'TRUE';
    if (siteKey && active) setupContentSheet(spreadsheet.getSheetByName(siteKey) || spreadsheet.insertSheet(siteKey));
  });
  SpreadsheetApp.getUi().alert('Template setup complete.');
}

export function validatePreviewCurrentSite() {
  runPreviewForActiveSheet(SpreadsheetApp.getActiveSpreadsheet(), Session.getActiveUser().getEmail());
}

export function validatePreviewAllSites() {
  runPreviewForAllSites(SpreadsheetApp.getActiveSpreadsheet(), Session.getActiveUser().getEmail());
}

export function uploadCurrentSite() {
  runUploadForActiveSheet(SpreadsheetApp.getActiveSpreadsheet(), Session.getActiveUser().getEmail());
}

export function uploadAllSites() {
  runUploadForAllSites(SpreadsheetApp.getActiveSpreadsheet(), Session.getActiveUser().getEmail());
}
```

- [x] **Step 2: Add Apps Script runtime note**

Because Apps Script does not execute ES module imports directly when files are pasted into the editor, document the deployment path in `README.md`:

````markdown
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
````

- [x] **Step 3: Run tests**

Run:

```bash
npm test
```

Expected: PASS. `src/Code.js` may not have direct Node tests because it wraps Apps Script globals.

- [x] **Step 4: Commit**

Run:

```bash
git add src/Code.js README.md
git commit -m "feat: add Apps Script menu entrypoints"
```

Expected: commit succeeds.

## Task 9: WordPress Taxonomy, Media, And Site Readiness

**Files:**
- Modify: `src/wordpress.js`
- Modify: `test/wordpress.test.mjs`
- Modify: `src/validation.js`

- [x] **Step 1: Add tests for taxonomy and media helpers**

Append to `test/wordpress.test.mjs`:

```js
import { buildMediaHeaders, parseTermSearchResult } from '../src/wordpress.js';

test('buildMediaHeaders creates content disposition with filename', () => {
  assert.deepEqual(buildMediaHeaders('admin', 'secret', 'image.jpg'), {
    Authorization: buildBasicAuthHeader('admin', 'secret'),
    'Content-Disposition': 'attachment; filename="image.jpg"',
  });
});

test('parseTermSearchResult returns exact case-insensitive match', () => {
  const terms = [{ id: 1, name: 'Bahasa Indonesia' }, { id: 2, name: 'IPA' }];
  assert.deepEqual(parseTermSearchResult(terms, 'bahasa indonesia'), { id: 1, name: 'Bahasa Indonesia' });
});
```

- [x] **Step 2: Run tests to verify failure**

Run:

```bash
npm test
```

Expected: FAIL because the new helper exports do not exist.

- [x] **Step 3: Implement taxonomy and media helpers**

Add to `src/wordpress.js`:

```js
export function parseTermSearchResult(terms, targetName) {
  const normalized = String(targetName || '').trim().toLowerCase();
  return terms.find((term) => String(term.name || '').trim().toLowerCase() === normalized) || null;
}

export function buildMediaHeaders(username, appPassword, filename) {
  return {
    Authorization: buildBasicAuthHeader(username, appPassword),
    'Content-Disposition': `attachment; filename="${filename}"`,
  };
}
```

Add these methods inside `WordPressClient`:

```js
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
```

- [x] **Step 4: Run tests**

Run:

```bash
npm test
```

Expected: PASS.

- [x] **Step 5: Commit**

Run:

```bash
git add src/wordpress.js test/wordpress.test.mjs src/validation.js
git commit -m "feat: add WordPress taxonomy and media helpers"
```

Expected: commit succeeds.

## Task 10: Documentation, Manual QA Checklist, And Final Review

**Files:**
- Modify: `README.md`
- Create: `docs/manual-qa.md`
- Modify: `docs/superpowers/plans/2026-06-17-wordpress-content-plan-uploader.md` only to check off completed steps during execution

- [x] **Step 1: Add manual QA checklist**

Create `docs/manual-qa.md`:

```markdown
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
```

- [x] **Step 2: Expand README operating instructions**

Add to `README.md`:

````markdown
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
````

- [x] **Step 3: Run full tests**

Run:

```bash
npm test
```

Expected: PASS.

- [x] **Step 4: Review plan/spec coverage**

Check:

Run the placeholder scan from this plan's self-review section against implementation files and docs, excluding the plan file itself.

Expected: no output.

- [x] **Step 5: Commit**

Run:

```bash
git add README.md docs/manual-qa.md
git commit -m "docs: add uploader operating guide and QA checklist"
```

Expected: commit succeeds.

## Spec Coverage Checklist

- Multi-site spreadsheet config: Tasks 2, 8.
- Authorized users: Task 3.
- Credentials in Apps Script Properties: Tasks 3, 8.
- Content tabs and standard columns: Tasks 1, 2.
- Dropdowns and conditional formatting: Task 2.
- Google Doc marker and HTML extraction: Task 5.
- `create_draft`: Tasks 6, 7.
- `update_existing` preserving post status: Tasks 6, 7.
- Parent/child categories and tags: Task 9.
- Featured image upload: Task 9.
- Yoast meta payload: Task 6.
- Preview/upload menus: Task 8.
- Upload log and row status behavior: Tasks 2, 7, 8.
- Manual QA: Task 10.
