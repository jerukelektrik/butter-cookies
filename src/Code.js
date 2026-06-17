import { SHEET_NAMES } from './constants.js';
import { setupSharedSheets, setupContentSheet } from './sheets.js';
import {
  runUploadForActiveSheet,
  runUploadForAllSites,
  runPreviewForActiveSheet,
  runPreviewForAllSites,
} from './uploader.js';

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
  const headers = values[0] || [];
  const siteKeyIndex = headers.indexOf('site_key');
  const activeIndex = headers.indexOf('active');

  values.slice(1).forEach((row) => {
    const siteKey = String(row[siteKeyIndex] || '').trim();
    const active = String(row[activeIndex] || '').trim().toUpperCase() === 'TRUE';
    if (siteKey && active) {
      setupContentSheet(spreadsheet.getSheetByName(siteKey) || spreadsheet.insertSheet(siteKey));
    }
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

if (typeof globalThis !== 'undefined') {
  globalThis.onOpen = onOpen;
  globalThis.setupTemplate = setupTemplate;
  globalThis.validatePreviewCurrentSite = validatePreviewCurrentSite;
  globalThis.validatePreviewAllSites = validatePreviewAllSites;
  globalThis.uploadCurrentSite = uploadCurrentSite;
  globalThis.uploadAllSites = uploadAllSites;
}
