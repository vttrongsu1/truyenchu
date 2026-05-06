import { createContext, useContext, useState, useEffect, useRef } from 'react';
import localforage from 'localforage';

let API_URL = localStorage.getItem('custom_api_url') || import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');
if (API_URL && API_URL.endsWith('/')) API_URL = API_URL.slice(0, -1);

const DownloadContext = createContext();

export const useDownload = () => useContext(DownloadContext);

export const DownloadProvider = ({ children }) => {
  const [queue, setQueue] = useState([]); // { id, storyInfo, range, status, progress, currentIdx, total }
  const [isProcessing, setIsProcessing] = useState(false);
  const cancelRef = useRef(false);

  // Lấy truyện đang tải đầu tiên trong hàng đợi để hiển thị (tương thích ngược)
  const activeJob = queue.find(j => j.status === 'downloading');
  const downloadingStory = activeJob ? { ...activeJob.storyInfo, currentIdx: activeJob.currentIdx, total: activeJob.total } : null;
  const progress = activeJob ? activeJob.progress : 0;

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

  // Logic xử lý hàng đợi
  useEffect(() => {
    const processNext = async () => {
      if (isProcessing) return;
      const nextJob = queue.find(j => j.status === 'pending');
      if (!nextJob) return;

      setIsProcessing(true);
      await runDownload(nextJob);
      setIsProcessing(false);
    };
    processNext();
  }, [queue, isProcessing]);

  const runDownload = async (job) => {
    const { storyInfo, range, id } = job;
    
    // Cập nhật trạng thái thành đang tải
    setQueue(prev => prev.map(j => j.id === id ? { ...j, status: 'downloading' } : j));
    
    sendNotification('Bắt đầu tải', `Đang tải truyện: ${storyInfo.title}`);

    try {
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

        // Cập nhật tiến độ vào hàng đợi
        setQueue(prev => prev.map(j => j.id === id ? { 
          ...j, 
          currentIdx: i + 1, 
          progress: Math.round((downloadedCount / totalToDownload) * 100) 
        } : j));
        
        try {
          if (cancelRef.current) break;
          const res = await fetch(`${API_URL}/api/scrape?url=${encodeURIComponent(storyInfo.chapters[i].url)}`);
          const result = await res.json();
          
          if (result.success && result.data) {
            offlineStory.chaptersData[i] = result.data;
          } else if (!offlineStory.chaptersData[i]) {
            offlineStory.chaptersData[i] = { chapterTitle: storyInfo.chapters[i].title, content: 'Chương này lỗi dữ liệu.' };
          }
        } catch (e) {
          if (!offlineStory.chaptersData[i]) {
            offlineStory.chaptersData[i] = { chapterTitle: storyInfo.chapters[i].title, content: 'Lỗi kết nối khi tải.' };
          }
        }
        
        downloadedCount++;
      }

      // Lưu vào thư viện
      if (existingStoryIdx > -1) library[existingStoryIdx] = offlineStory;
      else library.push(offlineStory);
      await localforage.setItem('library', library);

      const wasCancelled = cancelRef.current;
      if (wasCancelled) sendNotification('Đã dừng tải', `Đã dừng tải truyện: ${storyInfo.title}`);
      else sendNotification('Tải hoàn tất', `Đã hoàn thành tải ${downloadedCount} chương của ${storyInfo.title}`);

    } catch (err) {
      console.error("Lỗi khi tải truyện:", err);
    } finally {
      // Xóa khỏi hàng đợi sau khi hoàn thành hoặc lỗi/hủy
      setQueue(prev => prev.filter(j => j.id !== id));
      cancelRef.current = false;
    }
  };

  const startGlobalDownload = (storyInfo, range = null) => {
    console.log("Adding to queue:", storyInfo.title, range);
    const isInQueue = queue.some(j => j.storyInfo.title === storyInfo.title);
    if (isInQueue) return alert('Truyện này đã có trong hàng đợi!');

    const newJob = {
      id: Date.now().toString(),
      storyInfo,
      range,
      status: 'pending',
      progress: 0,
      currentIdx: 0,
      total: storyInfo.chapters.length
    };
    setQueue(prev => {
      const newQueue = [...prev, newJob];
      console.log("New Queue:", newQueue);
      return newQueue;
    });
  };


  const cancelDownload = (jobId = null) => {
    const activeJob = queue.find(j => j.status === 'downloading');
    if (jobId && activeJob && activeJob.id === jobId) {
      cancelRef.current = true;
    } else if (!jobId) {
      cancelRef.current = true;
    } else {
      // Nếu xóa truyện đang chờ
      setQueue(prev => prev.filter(j => j.id !== jobId));
    }
  };

  return (
    <DownloadContext.Provider value={{ downloadingStory, progress, queue, startGlobalDownload, cancelDownload }}>
      {children}
    </DownloadContext.Provider>
  );
};

