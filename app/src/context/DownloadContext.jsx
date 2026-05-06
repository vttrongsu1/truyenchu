import { createContext, useContext, useState, useEffect, useRef } from 'react';
import localforage from 'localforage';

let API_URL = localStorage.getItem('custom_api_url') || import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');
if (API_URL && API_URL.endsWith('/')) API_URL = API_URL.slice(0, -1);

const DownloadContext = createContext();

export const useDownload = () => useContext(DownloadContext);

export const DownloadProvider = ({ children }) => {
  const [downloadingStory, setDownloadingStory] = useState(null);
  const [progress, setProgress] = useState(0);
  const cancelRef = useRef(false);

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

  const startGlobalDownload = async (storyInfo, range = null) => {
    if (downloadingStory) return alert('Đang có truyện khác đang tải!');
    
    setDownloadingStory(storyInfo);
    setProgress(0);
    sendNotification('Bắt đầu tải', `Đang tải truyện: ${storyInfo.title}`);

    // Lấy truyện cũ từ thư viện nếu có để tải bổ sung
    const library = await localforage.getItem('library') || [];
    const storyKey = storyInfo.source || storyInfo.title;
    const existingStoryIdx = library.findIndex(s => (s.source === storyKey || s.title === storyKey));
    
    let offlineStory;
    if (existingStoryIdx > -1) {
      offlineStory = { ...library[existingStoryIdx], ...storyInfo, isOffline: true };
      if (!offlineStory.chaptersData) offlineStory.chaptersData = [];
    } else {
      offlineStory = {
        ...storyInfo,
        id: storyInfo.source || storyInfo.id || Date.now().toString(),
        chaptersData: [],
        isOffline: true
      };
    }

    const startIdx = range ? Math.max(0, range.from - 1) : 0;
    const endIdx = range ? Math.min(storyInfo.chapters.length, range.to) : storyInfo.chapters.length;
    const totalToDownload = endIdx - startIdx;
    
    cancelRef.current = false;
    let downloadedCount = 0;

    for (let i = startIdx; i < endIdx; i++) {
      if (cancelRef.current) break;
      // ...

      // Cập nhật trạng thái hiển thị
      setDownloadingStory({ ...storyInfo, currentIdx: i + 1, total: storyInfo.chapters.length });
      
      try {
        if (cancelRef.current) break;
        // Kiểm tra xem chương này đã có chưa (để tránh tải lại nếu không cần thiết)
        // Lưu ý: Chúng ta lưu index tương ứng với storyInfo.chapters
        const res = await fetch(`${API_URL}/api/scrape?url=${encodeURIComponent(storyInfo.chapters[i].url)}`);
        const result = await res.json();
        
        if (result.success && result.data) {
          offlineStory.chaptersData[i] = result.data;
        } else {
          if (!offlineStory.chaptersData[i]) {
            offlineStory.chaptersData[i] = { chapterTitle: storyInfo.chapters[i].title, content: 'Chương này lỗi dữ liệu.' };
          }
        }
      } catch (e) {
        if (!offlineStory.chaptersData[i]) {
          offlineStory.chaptersData[i] = { chapterTitle: storyInfo.chapters[i].title, content: 'Lỗi kết nối khi tải.' };
        }
      }
      
      downloadedCount++;
      setProgress(Math.round((downloadedCount / totalToDownload) * 100));
    }

    // Lưu lại vào thư viện
    if (existingStoryIdx > -1) {
      library[existingStoryIdx] = offlineStory;
    } else {
      library.push(offlineStory);
    }
    
    await localforage.setItem('library', library);
    const wasCancelled = cancelRef.current;
    setDownloadingStory(null);
    cancelRef.current = false;

    if (wasCancelled) {
      sendNotification('Đã dừng tải', `Đã dừng tải truyện: ${storyInfo.title}`);
    } else {
      sendNotification('Tải hoàn tất', `Đã hoàn thành tải ${downloadedCount} chương của ${storyInfo.title}`);
    }
  };

  const cancelDownload = () => {
    cancelRef.current = true;
  };

  return (
    <DownloadContext.Provider value={{ downloadingStory, progress, startGlobalDownload, cancelDownload }}>
      {children}
    </DownloadContext.Provider>
  );
};
