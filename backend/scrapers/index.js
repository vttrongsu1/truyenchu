const truyenfull = require('./truyenfull');
const tangthuvien = require('./tangthuvien');

// Danh sách các scraper được hỗ trợ
const scrapers = [
  truyenfull,
  tangthuvien
];

/**
 * Tìm scraper phù hợp dựa vào URL
 */
function getScraper(url) {
  return scrapers.find(s => url.includes(s.domain));
}

module.exports = {
  getScraper,
  scrapers
};
