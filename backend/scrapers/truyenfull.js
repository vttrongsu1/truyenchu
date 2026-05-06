const axios = require('axios');
const cheerio = require('cheerio');

const domain = 'truyenfull'; // Nhận diện mọi biến thể truyenfull.vn, .vision, .com...

async function getStoryInfo(url) {
  // Đảm bảo URL kết thúc bằng / để tránh lỗi redirect
  if (!url.endsWith('/')) {
    url += '/';
  }

  console.log(`[TruyenFull] Scraping Story Info: ${url}`);
  
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (khtml, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
      'Referer': 'https://www.google.com/'
    },
    timeout: 10000
  });

  const html = response.data;
  const $ = cheerio.select ? cheerio.load(html) : cheerio.load(html);

  const title = $('h3.title').text().trim() || $('h1').text().trim();
  const author = $('.info a[itemprop="author"]').text().trim() || 'Chưa rõ';
  const cover = $('.book img').attr('src') || '';
  const desc = $('.desc-text').text().trim();

  const chapters = [];
  const seenUrls = new Set();
  
  const extractChapters = (htmlContent) => {
    const $page = cheerio.load(htmlContent);
    $page('.col-truyen-main ul.list-chapter li a').each((i, el) => {
      const cUrl = $page(el).attr('href');
      const cTitle = $page(el).text().trim();
      if (cUrl && !seenUrls.has(cUrl)) {
        seenUrls.add(cUrl);
        chapters.push({ title: cTitle, url: cUrl });
      }
    });
  };

  extractChapters(html);

  let totalPages = 1;
  const hiddenTotal = $('#total-page').val();
  if (hiddenTotal) {
    totalPages = parseInt(hiddenTotal);
  } else {
    const lastPageLink = $('ul.pagination li:not(.next) a').last().attr('href');
    if (lastPageLink && lastPageLink.match(/trang-(\d+)/)) {
      totalPages = parseInt(lastPageLink.match(/trang-(\d+)/)[1]);
    } else {
      const selectText = $('select.form-control option').last().text() || '';
      if (selectText.match(/Trang (\d+)/i)) {
        totalPages = parseInt(selectText.match(/Trang (\d+)/i)[1]);
      }
    }
  }

  if (totalPages > 1) {
    console.log(`[TruyenFull] Phát hiện ${totalPages} trang chương. Đang lấy dữ liệu...`);
    const limit = Math.min(totalPages, 50); 
    for (let p = 2; p <= limit; p++) {
      const pageUrl = url.replace(/\/$/, '') + `/trang-${p}/`;
      try {
        await new Promise(r => setTimeout(r, 500));
        const pRes = await axios.get(pageUrl, { 
          headers: { 
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (khtml, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Referer': 'https://www.google.com/'
          },
          timeout: 10000 
        });
        extractChapters(pRes.data);
      } catch (err) {
        console.error(`[TruyenFull] Lỗi tải trang ${p}:`, err.message);
      }
    }
  }

  return { title, author, cover, desc, chapters, source: url };
}

async function getChapterContent(url) {
  console.log(`[TruyenFull] Scraping Chapter: ${url}`);
  
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (khtml, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Referer': 'https://www.google.com/'
    },
    timeout: 10000
  });

  const html = response.data;
  const $ = cheerio.select ? cheerio.load(html) : cheerio.load(html);

  const storyTitle = $('a.truyen-title').text().trim() || $('h1').text().trim();
  const chapterTitle = $('.chapter-title').text().trim() || $('h2').text().trim();
  
  let contentHtml = $('.chapter-c').html() || $('#chapter-c').html();
  
  if (!contentHtml) {
    throw new Error('Không tìm thấy nội dung truyện. Có thể cấu trúc web đã đổi hoặc bị chặn.');
  }

  const content$ = cheerio.load(contentHtml);
  content$('script, iframe, ins, .ads, div[id^="ads"]').remove();
  
  content$('br').replaceWith('\n');
  content$('p').each(function() {
    const pText = content$(this).text();
    content$(this).replaceWith(pText + '\n\n');
  });

  let plainText = content$.text().trim();
  plainText = plainText.replace(/\n\s*\n/g, '\n\n');

  return { storyTitle, chapterTitle, content: plainText, source: url };
}

module.exports = {
  domain,
  getStoryInfo,
  getChapterContent
};
