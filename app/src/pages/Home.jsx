import { useState, useEffect } from 'react';
import { Play, Clock, History, Trash2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import localforage from 'localforage';
import './Home.css';

let API_URL = localStorage.getItem('custom_api_url') || import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3001`;
if (API_URL.endsWith('/')) API_URL = API_URL.slice(0, -1);

if (window.location.protocol === 'https:' && API_URL.startsWith('http://') && !API_URL.includes('localhost')) {
  API_URL = API_URL.replace('http://', 'https://');
}
console.log("Đang kết nối tới Server tại:", API_URL);

export default function Home() {
  const navigate = useNavigate();
  const [library, setLibrary] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    try {
      const data = await localforage.getItem('library') || [];
      setLibrary(data);
    } catch (err) {
      console.error('Lỗi tải library:', err);
    }
  };

  const deleteStory = async (e, id) => {
    e.stopPropagation(); // prevent navigating
    if (window.confirm('Bạn có chắc muốn xóa bộ truyện này khỏi bộ nhớ máy?')) {
      const newLib = library.filter(s => s.id !== id);
      await localforage.setItem('library', newLib);
      setLibrary(newLib);
    }
  };

  const openOfflineStory = (story) => {
    navigate('/reader', { state: { offlineStory: story } });
  };

  const removeAccents = (str) => {
    return str 
      ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D') 
      : '';
  };

  const filteredLibrary = library.filter(story => {
    const searchVal = removeAccents(searchQuery.toLowerCase());
    const titleVal = removeAccents((story.title || '').toLowerCase());
    const authorVal = removeAccents((story.author || '').toLowerCase());
    return titleVal.includes(searchVal) || authorVal.includes(searchVal);
  });

  return (
    <div className="home-page">
      <div className="page-header">
        <h2>Xin chào,</h2>
        <p>Hôm nay bạn muốn nghe tiếp truyện gì?</p>
        
        <div style={{marginTop: '30px', padding: '15px', background: '#fff5eb', borderRadius: '12px', border: '1px dashed #ff7e00'}}>
          <label style={{fontSize: '12px', color: '#ff7e00', fontWeight: 'bold', display: 'block', marginBottom: '5px'}}>
            Sửa lỗi kết nối (Nếu không tải được truyện)
          </label>
          <input 
            type="text" 
            placeholder="Dán link Render tại đây: https://..." 
            defaultValue={localStorage.getItem('custom_api_url') || ''}
            style={{width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px'}}
            onBlur={(e) => {
              const val = e.target.value.trim();
              if (val) {
                localStorage.setItem('custom_api_url', val);
                alert('Đã lưu địa chỉ Server. Hãy thử tìm truyện lại nhé!');
                window.location.reload();
              }
            }}
          />
        </div>

        <div style={{marginTop: 16, display: 'flex', alignItems: 'center', background: 'var(--bg-color)', borderRadius: 12, padding: '10px 14px', border: '1px solid var(--border-color)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'}}>
          <Search size={18} color="var(--text-secondary)" style={{marginRight: 10}}/>
          <input 
            type="text" 
            placeholder="Tìm kiếm truyện trong tủ sách..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 15}}
          />
        </div>
      </div>

      <section className="history-section">
        <div className="section-header flex-between">
          <h3 className="flex-center"><History size={20} style={{marginRight: '8px', color: 'var(--primary)'}}/> Tủ Sách Offline</h3>
        </div>
        
        <div className="history-list">
          {filteredLibrary.length === 0 ? (
            <div style={{textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)'}}>
              <p style={{marginBottom: 16}}>{library.length === 0 ? 'Chưa có truyện nào được tải về.' : 'Không tìm thấy truyện nào.'}</p>
              {library.length === 0 && (
                <button 
                  onClick={() => navigate('/reader')}
                  style={{padding: '10px 20px', background: 'var(--primary)', color: 'white', borderRadius: 20, border: 'none', fontWeight: 'bold'}}
                >
                  Đi tới trang Tải Truyện
                </button>
              )}
            </div>
          ) : (
            filteredLibrary.map(story => (
              <div key={story.id} className="history-card" onClick={() => navigate('/reader', { state: { offlineStory: story, showPreview: true } })}>
                {story.cover ? <img src={story.cover} alt={story.title} className="history-cover" /> : <div className="history-cover" style={{background: '#ddd'}} />}
                <div className="history-info">
                  <h4 className="story-title text-truncate">{story.title}</h4>
                  <p className="story-progress" style={{fontSize: 13, color: 'var(--text-secondary)', marginTop: 4}}>
                    Đã đọc: Chương {(parseInt(localStorage.getItem(`story_progress_${story.title}`)) || 0) + 1} / {(story.chapters || []).length}
                  </p>
                  <div className="history-meta flex-between" style={{marginTop: 12}}>
                    <span className="flex-center" style={{fontSize: 11, background: '#4caf50', color: 'white', padding: '2px 6px', borderRadius: 4}}>
                      Đã tải {(story.chaptersData || []).length} chương
                    </span>
                    <div style={{display: 'flex', gap: 8}}>
                      <button className="play-circle-btn" onClick={(e) => deleteStory(e, story.id)} style={{background: 'var(--border-color)', color: 'var(--text-secondary)', boxShadow: 'none'}}>
                        <Trash2 size={14} />
                      </button>
                      <button className="play-circle-btn" onClick={(e) => { 
                        e.stopPropagation(); 
                        const lastIdx = parseInt(localStorage.getItem(`story_progress_${story.title}`)) || 0;
                        navigate('/reader', { state: { offlineStory: story, chapterIndex: lastIdx } }); 
                      }}>
                        <Play size={14} fill="white" className="play-icon-adjust" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
