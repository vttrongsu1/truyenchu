import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AppBar from './components/AppBar';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Player from './pages/Player';
import Reader from './pages/Reader';
import { DownloadProvider, useDownload } from './context/DownloadContext';

function AppContent() {
  const location = useLocation();
  const { downloadingStory, progress } = useDownload();

  const isPlayer = location.pathname === '/player';
  const isReading = location.pathname === '/reader' && !location.state?.forceSearch;
  const hideNav = isPlayer || isReading;

  return (
    <div className="app-container">
      {!hideNav && <AppBar />}
      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/player" element={<Player />} />
          <Route path="/reader" element={<Reader />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      
      {/* Thanh tiến trình tải ẩn */}
      {downloadingStory && !hideNav && (
        <div className="global-download-bar">
          <div className="g-info">Đang tải: {downloadingStory.title} ({progress}%)</div>
          <div className="g-progress"><div className="g-fill" style={{width: `${progress}%`}}></div></div>
        </div>
      )}

      {!hideNav && <BottomNav />}
    </div>
  );
}

function App() {
  return (
    <DownloadProvider>
      <Router>
        <AppContent />
      </Router>
    </DownloadProvider>
  );
}

export default App;
