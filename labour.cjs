// labour.cjs - GitHub Actions Optimised
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const { google } = require('googleapis');
const fs = require('fs');
const https = require('https');

const SHEET_ID = '1vi-z__fFdVhUZr3PEDjhM83kqhFtbJX0Ejcfu9M8RKo';
const SHEET_RANGE = 'R6.09!A3';
const NREGA_URL = 'https://nreganarep.nic.in/netnrega/dpc_sms_new.aspx?lflag=eng&page=b&Short_Name=MP&state_name=MADHYA+PRADESH&state_code=17&district_name=BALAGHAT&district_code=1738&block_name=KHAIRLANJI&block_code=1738002&fin_year=2025-2026&dt=&EDepartment=ALL&wrkcat=ALL&worktype=ALL&Digest=0Rg9WmyQmiHlGt6U8z1w4A';

// Custom HTTPS agent (disable SSL strict check if needed)
const agent = new https.Agent({ rejectUnauthorized: false });

// Fetch with retry
async function fetchWithRetry(url, retries = 5, delay = 5000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🌐 Fetching data (Attempt ${attempt})...`);
      const { data } = await axios.get(url, {
        httpsAgent: agent,
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive'
        }
      });
      return data;
    } catch (err) {
      console.warn(`⚠️ Attempt ${attempt} failed: ${err.message}`);
      if (attempt < retries) {
        console.log(`⏳ Waiting ${delay / 1000} seconds before retry...`);
        await new Promise(res => setTimeout(res, delay));
      } else {
        throw err;
      }
    }
  }
}

async function scrapeTables() {
  console.log('🔧 Running labour.cjs scrape...');
  const html = await fetchWithRetry(NREGA_URL);
  const $ = cheerio.load(html);

  const tables = $('table');
  const selectedIndexes = [1, 4];
  const finalData = [];

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
}

async function writeToSheet(data) {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'credentials.json'),
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
  try {
    const data = await scrapeTables();
    await writeToSheet(data);
  } catch (err) {
    console.error('❌ Error during process:', err);
    process.exit(1);
  }
}

main();
