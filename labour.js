// labour.js
const axios = require('axios');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const path = require('path');

// Google Sheets setup
const SHEET_ID = '1vi-z__fFdVhUZr3PEDjhM83kqhFtbJX0Ejcfu9M8RKo';
const SHEET_RANGE = 'R6.09!A3';

// NREGA URL
const NREGA_URL = 'https://nreganarep.nic.in/netnrega/dpc_sms_new.aspx?lflag=eng&page=b&Short_Name=MP&state_name=MADHYA+PRADESH&state_code=17&district_name=BALAGHAT&district_code=1738&block_name=KHAIRLANJI&block_code=1738002&fin_year=2025-2026&dt=&EDepartment=ALL&wrkcat=ALL&worktype=ALL&Digest=0Rg9WmyQmiHlGt6U8z1w4A';

async function scrapeTables(retries = 3, delayMs = 3000) {
  console.log('🔧 Running labour.js scrape...');
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data: html } = await axios.get(NREGA_URL, {
        timeout: 10000,  // 10 seconds timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; labour-scraper/1.0)'
        }
      });

      const $ = cheerio.load(html);
      const tables = $('table');
      const selectedIndexes = [1, 4]; // 2nd and 5th tables (0-based)
      let finalData = [];

      selectedIndexes.forEach(index => {
        const table = tables.eq(index);
        table.find('tr').each((_, row) => {
          const rowData = [];
          $(row).find('th, td').each((_, cell) => {
            rowData.push($(cell).text().trim());
          });
          if (rowData.length > 0) finalData.push(rowData);
        });
      });

      console.log(`📋 Extracted ${finalData.length - 1} data rows (plus header).`);
      return finalData;
    } catch (error) {
      console.error(`⚠️ Attempt ${attempt} failed: ${error.message}`);
      if (attempt < retries) {
        console.log(`⏳ Retrying in ${delayMs / 1000} seconds...`);
        await new Promise(res => setTimeout(res, delayMs));
      } else {
        throw error;  // After last attempt, throw error
      }
    }
  }
}

async function writeToSheet(data) {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'nrega-scraper.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: SHEET_RANGE,
    valueInputOption: 'RAW',
    requestBody: { values: data }
  });

  console.log('✅ Data successfully written to labour report R6.09!');
}

async function main() {
  const data = await scrapeTables();
  await writeToSheet(data);
}

main().catch(err => console.error('❌ Error:', err));
