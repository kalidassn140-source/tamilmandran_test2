// ════════════════════════════════════════════════
// TAMIL MANDIRAM — Google Apps Script
// This file goes into Google Apps Script editor
// Full setup instructions are in README.md
// ════════════════════════════════════════════════

function doPost(e) {
  try {
    // Parse the incoming data from the website form
    var data = JSON.parse(e.postData.contents);

    // Open the Google Sheet (it opens the sheet this script is attached to)
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // If this is the very first row, add headers
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Timestamp',
        'Name (English)',
        'பெயர் (Tamil)',
        'Education Type',
        'School Name',
        'Standard',
        'College Name',
        'Department',
        'Company',
        'Job Role',
        'City',
        'Phone',
        'Email',
        'Talents',
        'Other Talents Description'
      ]);
      // Make header row bold and colored
      var headerRange = sheet.getRange(1, 1, 1, 15);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#C8410B');
      headerRange.setFontColor('#FFFFFF');
    }

    // Add the new member's data as a new row
    sheet.appendRow([
      data.timestamp || new Date().toLocaleString(),
      data.nameEn || '',
      data.nameTa || '',
      data.education || '',
      data.schoolName || '',
      data.standard || '',
      data.collegeName || '',
      data.department || '',
      data.company || '',
      data.jobRole || '',
      data.city || '',
      data.phone || '',
      data.email || '',
      data.talents || '',
      data.othersDescription || ''
    ]);

    // Return success response
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // Return error response
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// This function handles GET requests (used for testing)
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'Tamil Mandiram Google Script is running!' }))
    .setMimeType(ContentService.MimeType.JSON);
}
