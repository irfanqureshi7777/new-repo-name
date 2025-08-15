// labour.cjs
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Utility: delay
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// Multiple user agents to avoid being blocked
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

// Retry wrapper
async function fetchWithRetry(url, retries = 7, waitMs = 7000) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      console.log(`🌐 Fetching data (Attempt ${attempt + 1})...`);
      const response = await axios.get(url, {
        timeout: 90000, // 90 sec timeout
        headers: {
          'User-Agent': USER_AGENTS[attempt % USER_AGENTS.length],
          'Accept-Language': 'en-US,en;q=0.9',
          Connection: 'keep-alive',
        },
        httpsAgent: new (require('https').Agent)({ keepAlive: true }),
      });
      return response.data;
    } catch (err) {
      console.warn(`⚠️ Attempt ${attempt + 1} failed: ${err.message}`);
      attempt++;
      if (attempt < retries) {
        console.log(`⏳ Waiting ${waitMs / 1000} seconds before retry...`);
        await delay(waitMs);
      } else {
        throw new Error(`❌ All ${retries} attempts failed. Last error: ${err.message}`);
      }
    }
  }
}

// Scrape logic
async function scrapeTables() {
  const url = 'https://nreganarep.nic.in/netnrega/dpc_sms_new.aspx?lflag=eng&page=b&Short_Name=MP&state_name=MADHYA+PRADESH&state_code=17&district_name=BALAGHAT&district_code=1738&block_name=KHAIRLANJI&block_code=1738002&fin_year=2025-2026&dt=&EDepartment=ALL&wrkcat=ALL&worktype=ALL&Digest=0Rg9WmyQmiHlGt6U8z1w4A';

  console.log(`🔧 Running labour.cjs scrape...`);
  const html = await fetchWithRetry(url);

  // Save HTML locally for debugging
  const outputPath = path.join(__dirname, 'labour_output.html');
  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`✅ HTML saved to ${outputPath}`);

  // TODO: parse HTML and extract data (Cheerio / regex)
  // Example:
  // const cheerio = require('cheerio');
  // const $ = cheerio.load(html);
  // const tableData = [];
  // $('table tr').each((_, row) => {
  //   tableData.push($(row).text().trim());
  // });
  // fs.writeFileSync('labour_data.json', JSON.stringify(tableData, null, 2));
}

async function main() {
  try {
    await scrapeTables();
  } catch (err) {
    console.error(`❌ Error during process: ${err.stack || err}`);
    process.exit(1);
  }
}

main();
