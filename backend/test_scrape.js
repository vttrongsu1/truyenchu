const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const url = 'https://truyenfull.vn/thap-nien-tieu-my-nhan-ngot-ngao-va-mem-mai-cua-thu-truong/'; // The story from the screenshot
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    }
  });
  
  const $ = cheerio.load(response.data);
  const paginationHtml = $('ul.pagination').html();
  console.log('Pagination HTML:', paginationHtml);
  
  const lastPageLink = $('ul.pagination li:not(.next) a').last().attr('href');
  console.log('lastPageLink:', lastPageLink);
}

test();
