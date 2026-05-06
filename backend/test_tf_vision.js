const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const url = 'https://truyenfull.vision/cam-nang-sinh-ton-cua-ke-me-an-o-co-dai/';
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    const paginationHtml = $('ul.pagination').html();
    console.log('Pagination HTML:', paginationHtml);
    
    const lastPageLink = $('ul.pagination li:not(.next) a').last().attr('href');
    console.log('lastPageLink:', lastPageLink);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
