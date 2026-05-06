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

const { getScraper, scrapers } = require('./scrapers');

app.get('/api/scrape', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  const scraper = getScraper(url);
  if (!scraper) {
    return res.status(400).json({ error: 'Trang web này hiện chưa được hỗ trợ.' });
  }

  try {
    const data = await scraper.getChapterContent(url);
    res.json({ success: true, data });
  } catch (error) {
    console.error(`Lỗi khi scrape chương (${scraper.domain}):`, error.message);
    res.status(500).json({ error: 'Không thể cào dữ liệu từ URL này.', details: error.message });
  }
});

app.get('/api/story', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  const scraper = getScraper(url);
  if (!scraper) {
    const supported = scrapers.map(s => s.domain).join(', ');
    return res.status(400).json({ error: `Trang web này chưa được hỗ trợ. Các trang hỗ trợ: ${supported}` });
  }

  try {
    const data = await scraper.getStoryInfo(url);
    res.json({ success: true, data });
  } catch (error) {
    console.error(`Lỗi khi scrape truyện (${scraper.domain}):`, error.message);
    res.status(500).json({ error: 'Không thể cào thông tin truyện từ URL này.', details: error.message });
  }
});

// Serve static files from the React frontend app
const frontendPath = path.join(__dirname, '../app/dist');
app.use(express.static(frontendPath));

// Any route that doesn't match an API route will serve the React index.html
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../app/dist/index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error("Error sending index.html:", err.message);
      res.status(404).send("Giao diện (Front-end) chưa được build hoặc không tìm thấy. Vui lòng kiểm tra lại quá trình deploy.");
    }
  });
});


app.listen(PORT, () => {
  console.log(`🚀 Backend Scraper đang chạy tại http://localhost:${PORT}`);
});
