import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Settings, Play, Pause, SkipBack, SkipForward, Menu, Download, Search, Loader, X, Type, Timer, Clock, Headphones } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import localforage from 'localforage';
import { useDownload } from '../context/DownloadContext';
import './Reader.css';

const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;

export default function Reader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { downloadingStory, progress, startGlobalDownload } = useDownload();
  
  // States
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [storyInfo, setStoryInfo] = useState(location.state?.offlineStory || null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(location.state?.chapterIndex || 0);
  const [chapterContent, setChapterContent] = useState(null);

  // TTS States
  const [isPlaying, setIsPlaying] = useState(false);
  const [sentences, setSentences] = useState([]);
  const [sentenceIndex, setSentenceIndex] = useState(-1);
  const [audioSource, setAudioSource] = useState(localStorage.getItem('tts_source') || 'system');
  const [rate, setRate] = useState(parseFloat(localStorage.getItem('tts_rate')) || 1);
  const [pitch, setPitch] = useState(parseFloat(localStorage.getItem('tts_pitch')) || 1);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(localStorage.getItem('tts_voice') || '');
  
  // UI States
  const [showSettings, setShowSettings] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [paragraphs, setParagraphs] = useState([]);
  const [fontSize, setFontSize] = useState(parseInt(localStorage.getItem('p_font_size')) || 20);
  const [sleepTimer, setSleepTimer] = useState(0); 
  const [timerActive, setTimerActive] = useState(false);
  const [defaultSleepMins, setDefaultSleepMins] = useState(parseInt(localStorage.getItem('default_sleep_mins')) || 0);

  const synth = window.speechSynthesis;
  const audioRef = useRef(new Audio());
  const isPlayingRef = useRef(false);
  const sentenceIndexRef = useRef(-1);
  const sentencesRef = useRef([]);

  // 1. Tự động ẩn/hiện thanh điều hướng hệ thống
  useEffect(() => {
    if (storyInfo) document.body.classList.add('hide-nav');
    else document.body.classList.remove('hide-nav');
    return () => document.body.classList.remove('hide-nav');
  }, [!!storyInfo]);

  // 2. Khởi tạo danh sách giọng đọc
  useEffect(() => {
    const loadVoices = () => {
      const v = synth.getVoices().filter(v => v.lang.toLowerCase().includes('vi'));
      setVoices(v.length > 0 ? v : synth.getVoices());
      if (!selectedVoice && v.length > 0) setSelectedVoice(v[0].name);
    };
    loadVoices();
    synth.onvoiceschanged = loadVoices;
    return () => { synth.cancel(); audioRef.current.pause(); };
  }, []);

  // 3. Logic đọc từng câu (TTS)
  const speakSentence = useCallback((index, forcedSentences = null) => {
    const currentSentences = forcedSentences || sentencesRef.current;
    if (index >= currentSentences.length) {
      if (currentChapterIndex < (storyInfo?.chapters?.length || 0) - 1) {
        loadChapter(currentChapterIndex + 1);
      } else {
        setIsPlaying(false);
        isPlayingRef.current = false;
      }
      return;
    }

    const text = currentSentences[index];
    if (storyInfo) {
      localStorage.setItem(`story_pos_${storyInfo.title}`, index);
      localStorage.setItem(`story_progress_${storyInfo.title}`, currentChapterIndex);
    }

    if (audioSource === 'google') {
      audioRef.current.src = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=vi&client=tw-ob`;
      audioRef.current.playbackRate = rate;
      audioRef.current.onended = () => {
        if (isPlayingRef.current) {
          const next = sentenceIndexRef.current + 1;
          setSentenceIndex(next);
          sentenceIndexRef.current = next;
          speakSentence(next);
        }
      };
      audioRef.current.play().catch(() => setIsPlaying(false));
    } else {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = voices.find(v => v.name === selectedVoice);
      if (voice) utterance.voice = voice;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.onend = () => {
        if (isPlayingRef.current) {
          const next = sentenceIndexRef.current + 1;
          setSentenceIndex(next);
          sentenceIndexRef.current = next;
          speakSentence(next);
        }
      };
      synth.speak(utterance);
    }
    
    setTimeout(() => {
      const el = document.querySelector('.sentence-highlight');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [audioSource, rate, selectedVoice, voices, currentChapterIndex, storyInfo]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      if (audioSource === 'google') audioRef.current.pause();
      else synth.pause();
      setIsPlaying(false);
      isPlayingRef.current = false;
    } else {
      setIsPlaying(true);
      isPlayingRef.current = true;
      
      // Tự động kích hoạt hẹn giờ nếu có cài đặt mặc định
      if (defaultSleepMins > 0 && sleepTimer <= 0) {
        setSleepTimer(defaultSleepMins * 60);
        setTimerActive(true);
      }

      const startIdx = sentenceIndex === -1 ? 0 : sentenceIndex;
      setSentenceIndex(startIdx);
      sentenceIndexRef.current = startIdx;
      speakSentence(startIdx);
    }
  }, [isPlaying, audioSource, sentenceIndex, speakSentence]);

  // 4. Load nội dung chương
  const loadChapter = useCallback(async (index) => {
    if (!storyInfo || !storyInfo.chapters[index]) return;
    setLoading(true);
    setCurrentChapterIndex(index);
    
    const lastSavedChapter = parseInt(localStorage.getItem(`story_progress_${storyInfo.title}`));
    let targetPos = 0;
    if (lastSavedChapter === index) {
      targetPos = parseInt(localStorage.getItem(`story_pos_${storyInfo.title}`)) || 0;
    }
    
    setSentenceIndex(targetPos);
    sentenceIndexRef.current = targetPos;

    try {
      let data = null;
      if (storyInfo.isOffline && storyInfo.chaptersData && storyInfo.chaptersData[index]) {
        data = storyInfo.chaptersData[index];
      } else {
        const cUrl = storyInfo.chapters[index].url;
        const res = await fetch(`${API_URL}/api/scrape?url=${encodeURIComponent(cUrl)}`);
        const result = await res.json();
        if (result.success) data = result.data;
        else throw new Error(result.error || 'Lỗi server');
      }
      
      if (data && data.content) {
        setChapterContent(data);
        const paragraphsRaw = data.content.split(/\n+/).filter(p => p.trim().length > 0);
        const allSentences = [data.chapterTitle];
        const structured = paragraphsRaw.map(p => {
          const sents = p.split(/(?<=[.!?])/).map(s => s.trim()).filter(s => s.length > 0);
          return sents.map(s => {
            allSentences.push(s);
            return { text: s, globalIdx: allSentences.length - 1 };
          });
        });

        setSentences(allSentences);
        sentencesRef.current = allSentences;
        setParagraphs(structured);
        
        if (isPlayingRef.current) {
          setTimeout(() => speakSentence(targetPos, allSentences), 500);
        }
      } else throw new Error('Không có nội dung.');
    } catch (err) {
      setError(err.message);
      setIsPlaying(false);
      isPlayingRef.current = false;
    } finally {
      setLoading(false);
      window.scrollTo(0, 0);
    }
  }, [storyInfo, speakSentence]);

  // 5. Khôi phục session
  useEffect(() => {
    if (location.state?.forceSearch) {
      setStoryInfo(null);
      setChapterContent(null);
      setCurrentChapterIndex(-1);
      return;
    }
    const resume = async () => {
      if (location.state?.offlineStory) {
        setStoryInfo(location.state.offlineStory);
        if (location.state.chapterIndex !== undefined) setCurrentChapterIndex(location.state.chapterIndex);
      } else if (!storyInfo) {
        const lastTitle = localStorage.getItem('last_played_story_title');
        if (lastTitle) {
          const lib = await localforage.getItem('library') || [];
          const found = lib.find(s => s.title === lastTitle);
          if (found) {
            setStoryInfo(found);
            setCurrentChapterIndex(parseInt(localStorage.getItem(`story_progress_${lastTitle}`)) || 0);
          }
        }
      }
    };
    resume();
  }, [location.state]);

  // 6. Tự động load chương
  useEffect(() => {
    if (storyInfo && !location.state?.forceSearch && !location.state?.showPreview) {
      loadChapter(currentChapterIndex);
    }
  }, [currentChapterIndex, !!storyInfo, loadChapter, location.state]);

  // 7. Lưu cấu hình & tiến độ
  useEffect(() => {
    localStorage.setItem('tts_source', audioSource);
    localStorage.setItem('tts_rate', rate);
    localStorage.setItem('tts_pitch', pitch);
    localStorage.setItem('tts_voice', selectedVoice);
    localStorage.setItem('p_font_size', fontSize);
    localStorage.setItem('default_sleep_mins', defaultSleepMins);
    
    if (storyInfo && chapterContent) {
      localStorage.setItem('last_played_story_title', storyInfo.title);
      localStorage.setItem(`story_progress_${storyInfo.title}`, currentChapterIndex);
      localStorage.setItem(`story_pos_${storyInfo.title}`, sentenceIndex);
    }
  }, [audioSource, rate, selectedVoice, fontSize, currentChapterIndex, !!storyInfo, !!chapterContent, sentenceIndex]);

  // --- LOGIC HẸN GIỜ TẮT (GIÂY) ---
  useEffect(() => {
    let interval = null;
    if (timerActive && sleepTimer > 0) {
      interval = setInterval(() => {
        setSleepTimer(prev => {
          if (prev <= 1) {
            setIsPlaying(false);
            isPlayingRef.current = false;
            synth.cancel();
            audioRef.current.pause();
            setTimerActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000); // Mỗi giây trừ 1 lần
    }
    return () => clearInterval(interval);
  }, [timerActive, sleepTimer]);

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key.toLowerCase() === 'p' || e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [togglePlay]);

  const handleBack = () => {
    if (showChapters) return setShowChapters(false);
    if (showSettings) return setShowSettings(false);
    if (chapterContent) {
      localStorage.setItem(`story_progress_${storyInfo.title}`, currentChapterIndex);
      localStorage.setItem(`story_pos_${storyInfo.title}`, sentenceIndex);
      setChapterContent(null); setIsPlaying(false); isPlayingRef.current = false;
      synth.cancel(); audioRef.current.pause(); navigate('/');
    } else if (storyInfo) {
      if (location.state?.forceSearch) { setStoryInfo(null); setError(''); }
      else navigate('/');
    } else navigate('/');
  };

  const fetchUrl = async () => {
    if (!url) return;
    setLoading(true); setError(''); setStoryInfo(null); setChapterContent(null);
    try {
      const isChapter = url.includes('/chuong-');
      const endpoint = isChapter ? '/api/scrape' : '/api/story';
      const response = await fetch(`${API_URL}${endpoint}?url=${encodeURIComponent(url)}`);
      const result = await response.json();
      if (result.success) {
        if (isChapter) setChapterContent(result.data);
        else setStoryInfo(result.data);
      } else setError(result.error || 'Không tìm thấy truyện.');
    } catch (err) { setError('Lỗi kết nối Server.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="mtc-reader">
      <header className="mtc-header flex-between">
        <button className="icon-btn" onClick={handleBack}><ArrowLeft size={24} /></button>
        <h2 className="mtc-title text-truncate">{storyInfo?.title || "Tải Truyện Mới"}</h2>
        <div style={{width: 24}}></div>
      </header>

      <main className={`mtc-content ${!storyInfo ? 'fetch-mode' : ''}`} style={{fontSize: `${fontSize}px`}}>
        {!storyInfo && !chapterContent && (
          <div className="mtc-fetch-container">
            <div className="mtc-fetch-card">
              <h3>Dán link từ TruyenFull</h3>
              <div className="mtc-search-bar flex-between">
                <input type="text" placeholder="https://truyenfull.vn/..." value={url} onChange={e => setUrl(e.target.value)} />
                <button onClick={fetchUrl} disabled={loading}>{loading ? '...' : <Search size={20}/>}</button>
              </div>
              {error && <p className="error-msg">{error}</p>}
            </div>
          </div>
        )}

        {storyInfo && !chapterContent && !loading && (
          <div className="mtc-story-preview">
            <img src={storyInfo.cover} alt="cover" className="preview-cover" />
            <h2 className="preview-title">{storyInfo.title}</h2>
            <p className="preview-author">{storyInfo.author}</p>
            <div className="preview-actions flex-gap">
              <button className="preview-btn-start" onClick={() => loadChapter(parseInt(localStorage.getItem(`story_progress_${storyInfo.title}`)) || 0)} style={{flex: 2}}>
                {localStorage.getItem(`story_progress_${storyInfo.title}`) ? 'Tiếp tục đọc' : 'Bắt đầu đọc'}
              </button>
              <button className="preview-btn-download" onClick={() => startGlobalDownload(storyInfo)} style={{flex: 1}}>
                {downloadingStory?.title === storyInfo.title ? `${progress}%` : (storyInfo.isOffline ? 'Đã tải' : 'Tải máy')}
              </button>
            </div>
            <div className="preview-chapters">
              <h3>Danh sách chương ({storyInfo.chapters.length})</h3>
              <div className="chapters-scroll-area">
                {storyInfo.chapters.map((c, i) => <div key={i} className="preview-chap-item" onClick={() => loadChapter(i)}>{c.title}</div>)}
              </div>
            </div>
          </div>
        )}

        {chapterContent && (
          <div className="mtc-chapter">
            <h1 className={`mtc-chapter-title mtc-sentence ${sentenceIndex === 0 ? 'sentence-highlight' : ''}`}
              onClick={() => { setSentenceIndex(0); sentenceIndexRef.current = 0; if(isPlaying) speakSentence(0); }}>
              {chapterContent.chapterTitle}
            </h1>
            <div className="mtc-text">
              {paragraphs.map((para, pIdx) => (
                <p key={pIdx} style={{marginBottom: '1.5em'}}>
                  {para.map((sObj, sIdx) => (
                    <span key={sIdx} className={`mtc-sentence ${sObj.globalIdx === sentenceIndex ? 'sentence-highlight' : ''}`}
                      onClick={() => { setSentenceIndex(sObj.globalIdx); sentenceIndexRef.current = sObj.globalIdx; if(isPlaying) speakSentence(sObj.globalIdx); }}>
                      {sObj.text}{' '}
                    </span>
                  ))}
                </p>
              ))}
            </div>
          </div>
        )}
      </main>

      {storyInfo && chapterContent && (
        <div className="mtc-bottom-bar">
          {timerActive && sleepTimer > 0 && <div className="timer-badge"><Clock size={12} /> {formatTimer(sleepTimer)}</div>}
          <div className="mtc-controls flex-between">
            <button className="ctrl-icon" onClick={() => setShowChapters(true)}><Menu size={22} /></button>
            <div className="main-ctrls flex-center">
              <button onClick={() => setCurrentChapterIndex(p => Math.max(0, p-1))}><SkipBack size={26} fill="currentColor" /></button>
              <button className="play-circle flex-center" onClick={togglePlay}>{isPlaying ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" style={{marginLeft:3}} />}</button>
              <button onClick={() => setCurrentChapterIndex(p => Math.min(storyInfo.chapters.length-1, p+1))}><SkipForward size={26} fill="currentColor" /></button>
            </div>
            <button className="ctrl-icon" onClick={() => setShowSettings(true)}><Settings size={22} /></button>
          </div>
        </div>
      )}

      {showChapters && (
        <div className="mtc-sheet-overlay overlay-left" onClick={() => setShowChapters(false)}>
          <div className="mtc-drawer-left" onClick={e => e.stopPropagation()}>
            <h3 style={{marginBottom:20, paddingLeft: 10}}>Danh sách chương</h3>
            <div className="chapters-scroll-area" style={{flex: 1}}>
              {storyInfo.chapters.map((c, i) => (
                <div key={i} className={`preview-chap-item ${i === currentChapterIndex ? 'active-chap' : ''}`} onClick={() => { loadChapter(i); setShowChapters(false); }}>{c.title}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="mtc-sheet-overlay overlay-bottom" onClick={() => setShowSettings(false)}>
          <div className="mtc-sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle"></div>
            <h3 style={{textAlign:'center', marginBottom:20}}>Cài đặt đọc truyện</h3>
            <div className="sheet-group">
              <label>Cỡ chữ: {fontSize}px</label>
              <div className="flex-gap">
                <button className="sheet-btn" onClick={() => setFontSize(Math.max(14, fontSize-2))}>A-</button>
                <button className="sheet-btn" onClick={() => setFontSize(Math.min(32, fontSize+2))}>A+</button>
              </div>
            </div>
            <div className="sheet-group">
              <label>Nguồn đọc</label>
              <select className="sheet-select" value={audioSource} onChange={e => setAudioSource(e.target.value)}>
                <option value="system">Hệ thống TTS</option>
                <option value="google">Google Translate</option>
              </select>
            </div>
            <div className="sheet-group">
              <label>Tốc độ đọc: {rate}x</label>
              <input type="range" min="0.5" max="2" step="0.1" value={rate} onChange={e => setRate(parseFloat(e.target.value))} className="sheet-slider" />
            </div>

            <div className="sheet-group">
              <label>Tông giọng (Pitch): {pitch}x</label>
              <input type="range" min="0.5" max="2" step="0.1" value={pitch} onChange={e => setPitch(parseFloat(e.target.value))} className="sheet-slider" />
            </div>
            <div className="sheet-group">
              <label>Hẹn giờ tắt: {sleepTimer > 0 ? formatTimer(sleepTimer) : 'Đang tắt'}</label>
              <div className="flex-gap" style={{marginBottom: 10}}>
                <input 
                  type="number" 
                  placeholder="Số phút..." 
                  className="sheet-input" 
                  style={{flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #ddd'}}
                  onChange={(e) => {
                    const mins = parseInt(e.target.value) || 0;
                    setDefaultSleepMins(mins);
                    setSleepTimer(mins * 60);
                    setTimerActive(mins > 0);
                  }}
                />
              </div>
              <div className="flex-gap" style={{flexWrap: 'wrap'}}>
                {[15, 30, 45, 60].map(m => (
                  <button key={m} className={`sheet-btn ${defaultSleepMins === m ? 'active-timer' : ''}`} 
                    onClick={() => { 
                      setDefaultSleepMins(m); 
                      setSleepTimer(m * 60); 
                      setTimerActive(true); 
                    }}
                    style={{padding: '8px 12px', minWidth: '55px', background: defaultSleepMins === m ? '#ff7e00' : '#fafafa', color: defaultSleepMins === m ? '#fff' : '#333'}}
                  >
                    {m}'
                  </button>
                ))}
                <button className="sheet-btn" onClick={() => { 
                  setDefaultSleepMins(0); 
                  setSleepTimer(0); 
                  setTimerActive(false); 
                }}
                  style={{padding: '8px 12px', minWidth: '55px', background: '#eee'}}
                >
                  Tắt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
