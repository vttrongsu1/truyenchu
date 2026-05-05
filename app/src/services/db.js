import localforage from 'localforage';

// Cấu hình Database
localforage.config({
  name: 'MeTruyenApp',
  storeName: 'stories_db'
});

// Lưu thông tin tổng quan của một truyện
export const saveStoryMeta = async (storyInfo) => {
  const stories = await getSavedStories();
  const index = stories.findIndex(s => s.source === storyInfo.source);
  
  if (index >= 0) {
    stories[index] = { ...stories[index], ...storyInfo, updatedAt: Date.now() };
  } else {
    stories.push({ ...storyInfo, createdAt: Date.now(), updatedAt: Date.now() });
  }
  
  await localforage.setItem('library_meta', stories);
};

// Lấy danh sách truyện đã lưu (cho Trang Chủ)
export const getSavedStories = async () => {
  const stories = await localforage.getItem('library_meta');
  return stories || [];
};

// Lưu nội dung 1 chương cụ thể
export const saveChapter = async (storySource, chapterIndex, chapterData) => {
  const key = `story_${btoa(storySource)}_chap_${chapterIndex}`;
  await localforage.setItem(key, chapterData);
};

// Đọc nội dung 1 chương cụ thể
export const getChapter = async (storySource, chapterIndex) => {
  const key = `story_${btoa(storySource)}_chap_${chapterIndex}`;
  return await localforage.getItem(key);
};

// Cập nhật tiến độ đọc truyện
export const updateReadingProgress = async (storySource, chapterIndex, chapterTitle) => {
  const stories = await getSavedStories();
  const index = stories.findIndex(s => s.source === storySource);
  
  if (index >= 0) {
    stories[index].lastReadIndex = chapterIndex;
    stories[index].lastReadTitle = chapterTitle;
    stories[index].updatedAt = Date.now();
    await localforage.setItem('library_meta', stories);
  }
};
