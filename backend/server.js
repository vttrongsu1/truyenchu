const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();

// Cấu hình CORS chi tiết để chắc chắn không bị chặn
app.use(cors({
  origin: '*', // Cho phép mọi trang web truy cập
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
const PORT = process.env.PORT || 3001;

app.get('/api/scrape', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    console.log(`Scraping: ${url}`);
    
    // Giả lập user-agent để không bị chặn
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (khtml, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Referer': 'https://www.google.com/'
      },
      timeout: 10000
    });

    console.log(`Tải nội dung chương thành công.`);

    const html = response.data;
    const $ = cheerio.select ? cheerio.load(html) : cheerio.load(html); // Cheerio load

    // Trích xuất dữ liệu từ TruyenFull
    // Cấu trúc TruyenFull:
    // Tiêu đề truyện: h1 hoặc .truyen-title
    // Tên chương: h2, .chapter-title
    // Nội dung: div.chapter-c hoặc div#chapter-c
    
    const storyTitle = $('a.truyen-title').text().trim() || $('h1').text().trim();
    const chapterTitle = $('.chapter-title').text().trim() || $('h2').text().trim();
    
    // Nội dung chương
    let contentHtml = $('.chapter-c').html() || $('#chapter-c').html();
    
    if (!contentHtml) {
      return res.status(404).json({ error: 'Không tìm thấy nội dung truyện. Có thể cấu trúc web đã đổi hoặc bị chặn.' });
    }

    // Xóa bớt các quảng cáo, iframe, script
    const content$ = cheerio.load(contentHtml);
    content$('script, iframe, ins, .ads, div[id^="ads"]').remove();
    
    // Chuyển <br> thành \n, p thành \n\n
    content$('br').replaceWith('\n');
    content$('p').each(function() {
      const pText = content$(this).text();
      content$(this).replaceWith(pText + '\n\n');
    });

    let plainText = content$.text().trim();
    
    // Chuẩn hóa khoảng trắng
    plainText = plainText.replace(/\n\s*\n/g, '\n\n');

    res.json({
      success: true,
      data: {
        storyTitle,
        chapterTitle,
        content: plainText,
        source: url
      }
    });

  } catch (error) {
    console.error('Lỗi khi scrape chương:', error.message);
    res.status(500).json({ error: 'Không thể cào dữ liệu từ URL này.', details: error.message });
  }
});

// API lấy thông tin truyện và danh sách chương
app.get('/api/story', async (req, res) => {
  let { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Đảm bảo URL kết thúc bằng / để tránh lỗi redirect
  if (!url.endsWith('/')) {
    url += '/';
  }

  try {
    console.log(`Scraping Story Info: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (khtml, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
        'Referer': 'https://www.google.com/'
      },
      timeout: 10000 // Chờ tối đa 10 giây
    });

    console.log(`Tải HTML thành công, bắt đầu xử lý...`);

    const html = response.data;
    const $ = cheerio.select ? cheerio.load(html) : cheerio.load(html);

    // 1. Lấy thông tin cơ bản và trang đầu tiên
    const title = $('h3.title').text().trim() || $('h1').text().trim();
    const author = $('.info a[itemprop="author"]').text().trim() || 'Chưa rõ';
    const cover = $('.book img').attr('src') || '';
    const desc = $('.desc-text').text().trim();

    // 2. Lấy danh sách chương trang 1
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

    // 3. Tìm các trang tiếp theo (Pagination)
    // TruyenFull dùng cấu trúc pagination hoặc link /trang-2/, /trang-3/...
    const lastPageLink = $('ul.pagination li:not(.next) a').last().attr('href');
    if (lastPageLink && lastPageLink.includes('trang-')) {
      const match = lastPageLink.match(/trang-(\d+)/);
      if (match) {
        const totalPages = parseInt(match[1]);
        console.log(`Phát hiện ${totalPages} trang chương. Đang lấy dữ liệu...`);
        
        // Giới hạn để tránh bị chặn hoặc quá tải (ví dụ max 20 trang = 1000 chương)
        const limit = Math.min(totalPages, 50); 
        
        for (let p = 2; p <= limit; p++) {
          const pageUrl = url.replace(/\/$/, '') + `/trang-${p}/`;
          try {
            await new Promise(r => setTimeout(r, 500)); // Delay 500ms để tránh bị chặn
            const pRes = await axios.get(pageUrl, { 
              headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Referer': 'https://www.google.com/'
              },
              timeout: 10000 
            });
            extractChapters(pRes.data);
          } catch (err) {
            console.error(`Lỗi tải trang ${p}:`, err.message);
          }
        }
      }
    }

    res.json({
      success: true,
      data: { title, author, cover, desc, chapters, source: url }
    });

  } catch (error) {
    console.error('Lỗi khi scrape truyện:', error.message);
    res.status(500).json({ error: 'Không thể cào thông tin truyện từ URL này.', details: error.message });
  }
});

// Serve static files from the React frontend app
const frontendPath = path.join(__dirname, '../app/dist');
app.use(express.static(frontendPath));

// Any route that doesn't match an API route will serve the React index.html
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Backend Scraper đang chạy tại http://localhost:${PORT}`);
});
