/**
 * ════════════════════════════════════════════════════════════
 *  TAMIL MANDRAM — DATA MANAGEMENT BACKEND (Google Apps Script)
 * ════════════════════════════════════════════════════════════
 *  This is the ONLY file you need to deploy. It powers every
 *  cloudList() / cloudSave() / cloudDelete() call already
 *  present in index.html and dashboard.html. Nothing on the
 *  website needs to change — this script just needs to exist
 *  behind the URL already pasted into CONFIG.GOOGLE_SCRIPT_URL.
 *
 *  IT MANAGES 5 TABS (auto-created on first use, no manual
 *  spreadsheet setup needed):
 *    1. Members                — registration form (index.html)
 *    2. CreativeRegistrations  — creative-competition sign-ups
 *    3. CreativePosts          — student creativity panel posts
 *    4. Notices                — single row (id:"current") that
 *                                 holds BOTH Top Performers and
 *                                 Upcoming Events together
 *    5. Pending                — Director/Coordinator's
 *                                 recommendations awaiting the
 *                                 President's approval
 *
 *  HOW EACH ROW IS STORED:
 *    Column A = id           (whatever id the website sent)
 *    Column B = data (JSON)  (the entire object, stored as-is)
 *    Column C = updatedAt    (server timestamp, ISO format)
 *  This generic shape means ANY sheet name the front-end ever
 *  sends (even a future one) works automatically — no schema
 *  changes needed if a field is added on the website side.
 *
 *  ── ONE-TIME SETUP ──
 *  1. Open (or create) the Google Sheet you want as the database.
 *  2. Copy the ENTIRE link from the browser address bar (the whole
 *     thing, don't trim anything) and paste it into SPREADSHEET_URL
 *     below. See README.md for exact steps.
 *  3. Extensions → Apps Script.
 *  4. Delete any existing code, paste this whole file in.
 *  5. Set CLOUD_KEY to EXACTLY match CONFIG.CLOUD_KEY in
 *     both index.html and dashboard.html (currently:
 *     'KALIdass63804271182006.') — this is what stops random
 *     people from writing to your sheet even though the URL is
 *     public.
 *  6. Run the function "setupSheets" once (▶ button, pick it
 *     from the dropdown) to pre-create all 5 tabs with headers.
 *     First run will ask you to authorize — approve it.
 *  7. Deploy → New deployment → type: Web app.
 *       Execute as:        Me
 *       Who has access:    Anyone
 *  8. Copy the Web App URL it gives you. If it's different from
 *     what's already in index.html / dashboard.html, paste the
 *     new one into CONFIG.GOOGLE_SCRIPT_URL in BOTH files (this
 *     is just a config value, not an architecture change).
 *  9. Whenever you edit this script again: Deploy → Manage
 *     deployments → ✎ edit → New version → Deploy. (Editing the
 *     code alone does NOT update the live URL — you must do
 *     this step or your changes won't take effect.)
 * ════════════════════════════════════════════════════════════
 */

// ── MUST match CONFIG.CLOUD_KEY in index.html and dashboard.html ──
const CLOUD_KEY = 'KALIdass63804271182006.';

// ── The exact Google Sheet this script reads/writes. ──
// Open your Spreadsheet in the browser and copy the WHOLE address-bar
// link (don't trim it, don't extract anything) — paste it below as-is.
// It will look like:
//   https://docs.google.com/spreadsheets/d/1AbCDeFGhiJKLmnoPQRstuVWxyz1234567890/edit#gid=0
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/19Z4zWiXPa--fjY6siGVLsdMnNUYPF3GVlLpOxlsZEgg/edit?gid=0#gid=0';

// The 5 tabs this backend manages. Add a name here later if you
// ever introduce a 6th data type — list/save/delete work for it
// automatically, this array is only used by setupSheets().
const SHEETS = ['Members', 'CreativeRegistrations', 'CreativePosts', 'Notices', 'Pending'];


// ════════════════════════════════════════════
// ENTRY POINTS
// ════════════════════════════════════════════

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'list') {
      const sheetName = e.parameter.sheet;
      if (!sheetName) return jsonOut({ ok: false, error: 'missing_sheet' });
      return jsonOut({ ok: true, rows: listRows(sheetName) });
    }
    return jsonOut({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === 'save') {
      if (body.key !== CLOUD_KEY) return jsonOut({ ok: false, error: 'unauthorized' });
      if (!body.sheet || body.id === undefined) return jsonOut({ ok: false, error: 'missing_fields' });
      const row = saveRow(body.sheet, body.id, body.data || {});
      return jsonOut({ ok: true, row: row });
    }

    if (action === 'delete') {
      if (body.key !== CLOUD_KEY) return jsonOut({ ok: false, error: 'unauthorized' });
      if (!body.sheet || body.id === undefined) return jsonOut({ ok: false, error: 'missing_fields' });
      deleteRow(body.sheet, body.id);
      return jsonOut({ ok: true });
    }

    return jsonOut({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}


// ════════════════════════════════════════════
// CORE STORAGE (generic — works for any sheet name)
// ════════════════════════════════════════════

function getSpreadsheet() {
  if (!SPREADSHEET_URL || SPREADSHEET_URL === 'PASTE_YOUR_FULL_GOOGLE_SHEET_LINK_HERE') {
    throw new Error('SPREADSHEET_URL is not set. Paste your full Sheet link at the top of Code.gs.');
  }
  // Accepts the FULL link as copied from the browser (no trimming needed).
  // Also tolerates someone pasting just the bare ID instead, just in case.
  const match = SPREADSHEET_URL.match(/\/d\/([a-zA-Z0-9-_]+)/);
  const id = match ? match[1] : SPREADSHEET_URL.trim();
  return SpreadsheetApp.openById(id);
}

function getSheet(name) {
  const ss = getSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, 3).setValues([['id', 'data (json)', 'updatedAt']]);
    sh.setFrozenRows(1);
    sh.setColumnWidth(2, 500);
  }
  return sh;
}

function listRows(sheetName) {
  const sh = getSheet(sheetName);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const values = sh.getRange(2, 1, lastRow - 1, 3).getValues();
  const rows = [];
  for (let i = 0; i < values.length; i++) {
    const id = values[i][0];
    const dataStr = values[i][1];
    const updatedAt = values[i][2];
    if (id === '' && dataStr === '') continue; // skip blank rows
    let parsed = {};
    try { parsed = dataStr ? JSON.parse(dataStr) : {}; } catch (e) { parsed = {}; }
    // Flatten: spread the saved object, then make sure id/updatedAt
    // always reflect the sheet's own columns (source of truth).
    rows.push(Object.assign({}, parsed, { id: id, updatedAt: updatedAt }));
  }
  return rows;
}

function findRowIndexById(sh, id) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sh.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2; // actual sheet row number
  }
  return -1;
}

function saveRow(sheetName, id, data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // up to 10s — avoids two simultaneous writes clobbering each other
  try {
    const sh = getSheet(sheetName);
    const idx = findRowIndexById(sh, id);
    const now = new Date().toISOString();
    const dataStr = JSON.stringify(data);
    if (idx === -1) {
      sh.appendRow([id, dataStr, now]);
    } else {
      sh.getRange(idx, 1, 1, 3).setValues([[id, dataStr, now]]);
    }
    return Object.assign({}, data, { id: id, updatedAt: now });
  } finally {
    lock.releaseLock();
  }
}

function deleteRow(sheetName, id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = getSheet(sheetName);
    const idx = findRowIndexById(sh, id);
    if (idx !== -1) sh.deleteRow(idx);
  } finally {
    lock.releaseLock();
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ════════════════════════════════════════════
// DIAGNOSTIC HELPER
// Run THIS directly from the editor (not via the web URL) to check
// whether SPREADSHEET_URL is correctly saved, without needing to
// redeploy first. Look at the "Execution log" at the bottom after
// running it.
// ════════════════════════════════════════════
function testConnection() {
  Logger.log('SPREADSHEET_URL is currently: ' + SPREADSHEET_URL);
  const ss = getSpreadsheet();
  Logger.log('SUCCESS — connected to spreadsheet named: ' + ss.getName());
}


// ════════════════════════════════════════════
// ONE-TIME SETUP HELPER
// Run this once from the Apps Script editor to pre-create
// all 5 tabs with proper headers before you deploy.
// ════════════════════════════════════════════
function setupSheets() {
  SHEETS.forEach(getSheet);
  getSpreadsheet().toast('All 5 tabs are ready: ' + SHEETS.join(', '));
}
