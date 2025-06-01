const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const fs = require('fs');

const SHEET_ID = '1vi-z__fFdVhUZr3PEDjhM83kqhFtbJX0Ejcfu9M8RKo';
const SHEET_RANGE = 'R6.09!A3'; // Your sheet tab name and starting cell

const NREGA_URL = 'https://nreganarep.nic.in/netnrega/dpc_sms_new.aspx?lflag=eng&page=b&Short_Name=MP&state_name=MADHYA+PRADESH&state_code=17&district_name=BALAGHAT&district_code=1738&block_name=KHAIRLANJI&block_code=1738002&fin_year=2025-2026&dt=&EDepartment=ALL&wrkcat=ALL&worktype=ALL&Digest=0Rg9WmyQmiHlGt6U8z1w4A';

const CREDENTIALS_PATH = './credentials.json';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

async function authorizeGoogleSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: SCOPES,
  });
  return await auth.getClient();
}

async function scrapeNregaTable(url) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36'
  );

  try {
    console.log(`Navigating to ${url} ...`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 0 }); // no timeout limit
    await page.waitForTimeout(3000); // wait extra 3 sec for full load

    const content = await page.content();
    const $ = cheerio.load(content);
    const tables = $('table');

    if (tables.length < 4) {
      throw new Error(`Expected at least 4 tables on the page, found ${tables.length}`);
    }

    const targetTable = tables.eq(3);
    const rows = targetTable.find('tr');
    const data = [];

    rows.each((i, row) => {
      const cols = $(row).find('td');
      if (cols.length === 0) return; // skip headers or empty rows

      const rowData = [];
      cols.each((j, col) => {
        rowData.push($(col).text().trim());
      });
      data.push(rowData);
    });

    await browser.close();
    return data;
  } catch (error) {
    try {
      await page.screenshot({ path: 'error_screenshot.png', fullPage: true });
      console.log('Screenshot saved as error_screenshot.png');
    } catch (screenshotError) {
      console.error('Failed to take screenshot:', screenshotError);
    }

    await browser.close();
    throw error;
  }
}

async function writeToSheet(authClient, sheetId, range, values) {
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  const resource = { values };
  const res = await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range,
    valueInputOption: 'RAW',
    resource,
  });

  console.log('Google Sheets update response:', res.data);
}

(async () => {
  try {
    console.log('Starting scrape and upload process...');
    const tableData = await scrapeNregaTable(NREGA_URL);

    console.log('Authorizing Google Sheets...');
    const authClient = await authorizeGoogleSheets();

    console.log(`Writing ${tableData.length} rows to Google Sheet...`);
    await writeToSheet(authClient, SHEET_ID, SHEET_RANGE, tableData);

    console.log('Data written successfully.');
  } catch (error) {
    console.error('Error during scraping or upload:', error);
  }
})();
