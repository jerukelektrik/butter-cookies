import { SHEET_NAMES } from './constants.js';
import { setupSharedSheets, setupContentSheet } from './sheets.js';
import {
  runUploadForActiveSheet,
  runUploadForAllSites,
  runPreviewForActiveSheet,
  runPreviewForAllSites,
  runTestConnectionForActiveSheet,
} from './uploader.js';

export function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('WP Content Uploader')
    .addItem('Setup Template', 'setupTemplate')
    .addSeparator()
    .addItem('Test Connection for Current Site', 'testConnectionCurrentSite')
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

export function testConnectionCurrentSite() {
  const ui = SpreadsheetApp.getUi();
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const userEmail = Session.getActiveUser().getEmail();
    const result = runTestConnectionForActiveSheet(spreadsheet, userEmail);
    if (result.success) {
      const rolesStr = result.roles.join(', ') || 'none';
      let msg = `✅ Connection Successful!\n\n` +
                `• WordPress User: ${result.name} (${result.username})\n` +
                `• User ID: ${result.id}\n` +
                `• Roles: ${rolesStr}\n\n`;

      const canCreatePosts = result.capabilities.edit_posts || result.capabilities.publish_posts || false;
      if (canCreatePosts) {
        msg += `🎉 Your user account has permissions to create/edit posts.`;
      } else {
        msg += `⚠️ WARNING: Your user account does not appear to have 'edit_posts' capability. You might not be able to create posts. Please elevate your user role to Contributor, Author, Editor, or Administrator.`;
      }
      ui.alert('WP Connection Test', msg, ui.ButtonSet.OK);
    } else {
      let msg = `❌ Connection Failed!\n\n` +
                `Error Details:\n${result.error}\n\n` +
                `Troubleshooting checklist:\n` +
                `1. Check if the WordPress URL, username, and Application Password are correct.\n` +
                `2. Verify that you are using an Application Password (Users > Profile > Application Passwords) and NOT your login password.\n` +
                `3. If you still get 401, your web server (e.g. Apache) might be stripping the Authorization header. You may need to add this to your .htaccess:\n` +
                `   RewriteEngine On\n` +
                `   RewriteCond %{HTTP:Authorization} ^(.*)\n` +
                `   RewriteRule .* - [E=HTTP_AUTHORIZATION:%1]\n` +
                `4. Check if security plugins like Wordfence are blocking REST API requests or Application Passwords.`;
      ui.alert('WP Connection Test', msg, ui.ButtonSet.OK);
    }
  } catch (error) {
    ui.alert('WP Connection Test Error', `Error: ${error.message}`, ui.ButtonSet.OK);
  }
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
  globalThis.testConnectionCurrentSite = testConnectionCurrentSite;
  globalThis.validatePreviewCurrentSite = validatePreviewCurrentSite;
  globalThis.validatePreviewAllSites = validatePreviewAllSites;
  globalThis.uploadCurrentSite = uploadCurrentSite;
  globalThis.uploadAllSites = uploadAllSites;
}

// Unused dummy function to force Google Apps Script to request Docs and Drive scopes
function dummyPermissionsTrigger() {
  if (false) {
    DocumentApp.create('dummy');
    DriveApp.getFiles();
  }
}
