const axios = require('axios');
const cheerio = require('cheerio');

const domain = 'tangthuvien.vn';

async function getStoryInfo(url) {
  console.log(`[TangThuVien] Scraping Story Info: ${url}`);
  
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    timeout: 10000
  });

  const html = response.data;
  const $ = cheerio.load(html);

  const title = $('h1').text().trim();
  const author = $('.author a').first().text().trim() || 'Chưa rõ';
  const cover = $('.book-img img').attr('src') || '';
  const desc = $('.book-intro p').text().trim() || $('.book-info-detail .intro').text().trim();

  // TangThuVien often uses API to load chapters or a specific UL
  // This is a basic extraction. For full extraction, it might need to call their API
  // https://truyen.tangthuvien.vn/doc-truyen/page/...
  
  // First, look for a hidden input containing story ID
  const storyId = $('input[name="story_id"]').val();
  
  const chapters = [];
  const seenUrls = new Set();
  
  // Basic fallback: just grab any chapter links on the main page
  $('#chuong-list a, .chapter-list a, ul.list-chapter li a').each((i, el) => {
    const cUrl = $(el).attr('href');
    const cTitle = $(el).text().trim();
    if (cUrl && cUrl.includes('chuong-') && !seenUrls.has(cUrl)) {
      seenUrls.add(cUrl);
      chapters.push({ title: cTitle, url: cUrl });
    }
  });

  // If we found storyId, we might be able to fetch all chapters via API (simplified here)
  // For the sake of this basic scraper, we just return what we found on page 1.
  
  return { title, author, cover, desc, chapters, source: url };
}

async function getChapterContent(url) {
  console.log(`[TangThuVien] Scraping Chapter: ${url}`);
  
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    timeout: 10000
  });

  const html = response.data;
  const $ = cheerio.load(html);

  const storyTitle = $('.truyen-title, .book-name').text().trim();
  const chapterTitle = $('h2, .chapter h1').text().trim();
  
  let contentHtml = $('.box-chap, .chapter-c, #chapter-c').html();
  
  if (!contentHtml) {
    throw new Error('Không tìm thấy nội dung truyện trên TangThuVien.');
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
