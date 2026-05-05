import { createContext, useContext, useState, useEffect } from 'react';
import localforage from 'localforage';

const DownloadContext = createContext();

export const useDownload = () => useContext(DownloadContext);

export const DownloadProvider = ({ children }) => {
  const [downloadingStory, setDownloadingStory] = useState(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  const sendNotification = (title, body) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: '/logo192.png' });
    }
  };

  const startGlobalDownload = async (storyInfo) => {
    if (downloadingStory) return alert('Đang có truyện khác đang tải!');
    
    setDownloadingStory(storyInfo);
    setProgress(0);
    sendNotification('Bắt đầu tải', `Đang tải truyện: ${storyInfo.title}`);

    // Khởi tạo bộ truyện offline mới, xóa sạch dữ liệu cũ để tránh cộng dồn
    const offlineStory = {
      ...storyInfo,
      id: storyInfo.source || storyInfo.id || Date.now().toString(),
      chaptersData: [],
      isOffline: true
    };

    const total = storyInfo.chapters.length;
    for (let i = 0; i < total; i++) {
      setDownloadingStory({ ...storyInfo, currentIdx: i + 1, total });
      try {
        const res = await fetch(`http://${window.location.hostname}:3001/api/scrape?url=${encodeURIComponent(storyInfo.chapters[i].url)}`);
        const result = await res.json();
        if (result.success && result.data) {
          offlineStory.chaptersData.push(result.data);
        } else {
          offlineStory.chaptersData.push({ chapterTitle: storyInfo.chapters[i].title, content: 'Chương này lỗi dữ liệu.' });
        }
      } catch (e) {
        offlineStory.chaptersData.push({ chapterTitle: storyInfo.chapters[i].title, content: 'Lỗi kết nối khi tải.' });
      }
      setProgress(Math.round(((i + 1) / total) * 100));
    }

    // Lưu vào thư viện
    const library = await localforage.getItem('library') || [];
    const storyKey = offlineStory.source || offlineStory.title;
    const idx = library.findIndex(s => (s.source === storyKey || s.title === storyKey));
    
    if (idx > -1) {
      library[idx] = offlineStory;
    } else {
      library.push(offlineStory);
    }
    
    await localforage.setItem('library', library);
    setDownloadingStory(null);
    sendNotification('Tải hoàn tất', `Đã tải xong ${offlineStory.chaptersData.length} chương của ${storyInfo.title}`);
  };

  return (
    <DownloadContext.Provider value={{ downloadingStory, progress, startGlobalDownload }}>
      {children}
    </DownloadContext.Provider>
  );
};
