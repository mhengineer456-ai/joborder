const { fetchSheetsValues, jobOrderSpreadsheetId } = require('../backend/src/services/sheetsService');

async function testSync() {
  try {
    console.log('Fetching Serials sheet range A1:B20...');
    const rows = await fetchSheetsValues(jobOrderSpreadsheetId, 'Serials!A1:B20');
    console.log('Fetched Serials rows:', JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

testSync();
