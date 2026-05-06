const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const url = 'https://truyenfull.vision/cam-nang-sinh-ton-cua-ke-me-an-o-co-dai/';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (khtml, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Referer': 'https://www.google.com/'
  };

  try {
    const p1 = await axios.get(url, { headers, timeout: 10000 });
    const $ = cheerio.load(p1.data);
    const totalPages = parseInt($('#total-page').val() || 1);
    console.log('Total pages:', totalPages);

    for (let p = 2; p <= Math.min(totalPages, 5); p++) {
      const pageUrl = url.replace(/\/$/, '') + `/trang-${p}/`;
      console.log(`Fetching ${pageUrl}`);
      await new Promise(r => setTimeout(r, 500));
      try {
        const pRes = await axios.get(pageUrl, { headers, timeout: 10000 });
        const p$ = cheerio.load(pRes.data);
        console.log(`Page ${p} fetched. Chapters:`, p$('.list-chapter li a').length);
      } catch (err) {
        console.error(`Page ${p} error:`, err.message);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
