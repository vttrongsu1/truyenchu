const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const url = 'https://truyenfull.vision/cam-nang-sinh-ton-cua-ke-me-an-o-co-dai/';
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (khtml, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    console.log('Hidden total-page:', $('#total-page').val());
    console.log('Select page:', $('select.form-control option').last().text());
    console.log('ul.pagination:', $('ul.pagination').html());
    
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
