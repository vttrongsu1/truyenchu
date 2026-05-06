const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const url = 'https://truyenfull.vn/thap-nien-tieu-my-nhan-ngot-ngao-va-mem-mai-cua-thu-truong/';
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (khtml, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
        'Referer': 'https://www.google.com/'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    const chapters = [];
    $('.col-truyen-main ul.list-chapter li a').each((i, el) => {
        chapters.push($(el).text().trim());
    });
    console.log('Chapters found:', chapters.length);
    
    const lastPageLink = $('ul.pagination li:not(.next) a').last().attr('href');
    console.log('lastPageLink:', lastPageLink);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
