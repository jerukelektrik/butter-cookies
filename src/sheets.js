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

export function getSheetRecords(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  return values.slice(1).map((row, index) => ({
    rowNumber: index + 2,
    values: row,
    record: mapRowToObject(headers, row),
  }));
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

export function buildUploadLogRow(headers, entry) {
  return headers.map((header) => entry[header] ?? '');
}

export function appendUploadLog(spreadsheet, entry) {
  const sheet = ensureSheet(spreadsheet, SHEET_NAMES.uploadLog);
  ensureHeaders(sheet, UPLOAD_LOG_HEADERS);
  sheet.appendRow(buildUploadLogRow(UPLOAD_LOG_HEADERS, entry));
}

export function writeContentRowResult(sheet, rowNumber, result, processedAt = new Date()) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const headerMap = buildHeaderMap(headers);
  const writable = {
    wordpress_post_id: result.wordpress_post_id,
    wordpress_draft_url: result.wordpress_draft_url,
    upload_status: result.status,
    validation_notes: result.validation_notes,
    error_notes: result.error_notes,
    last_processed_at: processedAt,
  };

  Object.entries(writable).forEach(([header, value]) => {
    if (headerMap[header] === undefined || value === undefined) return;
    sheet.getRange(rowNumber, headerMap[header] + 1).setValue(value);
  });
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
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(values, true)
      .setAllowInvalid(false)
      .build();
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
    sheet
      .getRange(row, headerMap.meta_description_check + 1)
      .setFormula(buildMetaCheckFormula(descLengthCell, 'description'));
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
