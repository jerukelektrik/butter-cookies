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
  const headers = {};
  if (typeof ScriptApp !== 'undefined') {
    headers['Authorization'] = `Bearer ${ScriptApp.getOAuthToken()}`;
  }
  const response = fetcher(exportUrl, {
    method: 'get',
    muteHttpExceptions: true,
    followRedirects: true,
    headers,
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error(`Google Doc export failed with HTTP ${status}`);
  }
  const cleaned = cleanExportedHtml(response.getContentText());
  return sliceAfterMarker(cleaned);
}
