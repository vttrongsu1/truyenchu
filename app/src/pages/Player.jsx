import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Menu, Settings, HelpCircle, Play, Pause, SkipBack, SkipForward, Timer, X, Type, Languages, RotateCcw, RotateCw, Power } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import localforage from 'localforage';
import './Player.css';

export default function Player() {
  const navigate = useNavigate();
  const location = useLocation();
  const offlineStory = location.state?.offlineStory || null;
  const initialChapterIndex = location.state?.chapterIndex || 0;

  const [story, setStory] = useState(offlineStory);
  const [chapterIndex, setChapterIndex] = useState(initialChapterIndex);
  const [sentences, setSentences] = useState([]);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  
  // TTS Settings
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(localStorage.getItem('tts_voice') || '');
  const [rate, setRate] = useState(parseFloat(localStorage.getItem('tts_rate')) || 1);
  const [pitch, setPitch] = useState(parseFloat(localStorage.getItem('tts_pitch')) || 1);
  const [audioSource, setAudioSource] = useState(localStorage.getItem('tts_source') || 'system');

  // Typography Settings
  const [fontSize, setFontSize] = useState(parseInt(localStorage.getItem('p_font_size')) || 20);
  const [fontFamily, setFontFamily] = useState(localStorage.getItem('p_font_family') || 'serif');

  const synth = window.speechSynthesis;
  const audioRef = useRef(new Audio());
  const isPlayingRef = useRef(false);
  const sentenceIndexRef = useRef(0);
  const scrollRef = useRef(null);

  // Lưu lịch sử
  useEffect(() => {
    if (story) {
      localStorage.setItem('last_played_story_id', story.id);
      localStorage.setItem('last_played_chapter_index', chapterIndex);
      localStorage.setItem(`pos_${story.id}_${chapterIndex}`, sentenceIndex);
      localStorage.setItem('p_font_size', fontSize);
      localStorage.setItem('p_font_family', fontFamily);
    }
  }, [story, chapterIndex, sentenceIndex, fontSize, fontFamily]);

  // Tự động cuộn theo câu đang đọc
  useEffect(() => {
    const activeEl = document.querySelector('.sentence-item.active');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [sentenceIndex]);

  // Load truyện
  useEffect(() => {
    const loadLastPlayed = async () => {
      const lastId = localStorage.getItem('last_played_story_id');
      const lastIdx = parseInt(localStorage.getItem('last_played_chapter_index')) || 0;
      
      if (!story && lastId) {
        const library = await localforage.getItem('library') || [];
        const found = library.find(s => s.id === lastId);
        if (found) {
          setStory(found);
          setChapterIndex(lastIdx);
          const savedSentenceIdx = parseInt(localStorage.getItem(`pos_${found.id}_${lastIdx}`)) || 0;
          setSentenceIndex(savedSentenceIdx);
          sentenceIndexRef.current = savedSentenceIdx;
        }
      } else if (story) {
        const savedSentenceIdx = parseInt(localStorage.getItem(`pos_${story.id}_${chapterIndex}`)) || 0;
        setSentenceIndex(savedSentenceIdx);
        sentenceIndexRef.current = savedSentenceIdx;
      }
    };
    loadLastPlayed();
  }, [story, chapterIndex]);

  // Khởi tạo nội dung
  useEffect(() => {
    let rawContent = '';
    if (story && story.chaptersData[chapterIndex]) {
      rawContent = story.chaptersData[chapterIndex].content;
    } else {
      rawContent = `Vui lòng chọn truyện để bắt đầu nghe.`;
    }
    const chunks = rawContent.split(/(?<=[.!?\n])/).map(s => s.trim()).filter(s => s.length > 0);
    setSentences(chunks);
    synth.cancel();
    audioRef.current.pause();
    setIsPlaying(false);
    isPlayingRef.current = false;
  }, [story, chapterIndex]);

  // Load Voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = synth.getVoices();
      const vnVoices = availableVoices.filter(v => v.lang.toLowerCase().includes('vi'));
      setVoices(vnVoices.length > 0 ? vnVoices : availableVoices);
      if (!selectedVoice && vnVoices.length > 0) setSelectedVoice(vnVoices[0].name);
    };
    loadVoices();
    synth.onvoiceschanged = loadVoices;
    return () => { synth.cancel(); audioRef.current.pause(); };
  }, []);

  const speakSentence = (index) => {
    if (index >= sentences.length) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      if (story && chapterIndex < story.chaptersData.length - 1) nextChapter();
      return;
    }

    const text = sentences[index];
    if (audioSource === 'google') {
      audioRef.current.src = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=vi&client=tw-ob`;
      audioRef.current.playbackRate = rate;
      audioRef.current.onended = () => {
        if (isPlayingRef.current) {
          const nextIdx = sentenceIndexRef.current + 1;
          setSentenceIndex(nextIdx);
          sentenceIndexRef.current = nextIdx;
          speakSentence(nextIdx);
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
          const nextIdx = sentenceIndexRef.current + 1;
          setSentenceIndex(nextIdx);
          sentenceIndexRef.current = nextIdx;
          speakSentence(nextIdx);
        }
      };
      synth.speak(utterance);
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      if (audioSource === 'google') audioRef.current.pause();
      else synth.pause();
      setIsPlaying(false);
      isPlayingRef.current = false;
    } else {
      if (audioSource === 'google') {
        if (audioRef.current.src) audioRef.current.play();
        else speakSentence(sentenceIndexRef.current);
      } else {
        if (synth.paused) synth.resume();
        else speakSentence(sentenceIndexRef.current);
      }
      setIsPlaying(true);
      isPlayingRef.current = true;
    }
  };

  const nextChapter = () => {
    if (story && chapterIndex < story.chaptersData.length - 1) {
      setChapterIndex(prev => prev + 1);
      setSentenceIndex(0);
      sentenceIndexRef.current = 0;
    }
  };

  const prevChapter = () => {
    if (story && chapterIndex > 0) {
      setChapterIndex(prev => prev - 1);
      setSentenceIndex(0);
      sentenceIndexRef.current = 0;
    }
  };

  const jumpToSentence = (idx) => {
    setSentenceIndex(idx);
    sentenceIndexRef.current = idx;
    if (isPlaying) speakSentence(idx);
    else {
      setIsPlaying(true);
      isPlayingRef.current = true;
      speakSentence(idx);
    }
  };

  const chapTitle = story && story.chaptersData[chapterIndex] ? story.chaptersData[chapterIndex].chapterTitle : "Chương...";

  return (
    <div className="player-page premium-player">
      {/* Background Blur */}
      <div className="p-bg-blur" style={{backgroundImage: `url(${story?.cover})`}}></div>

      <header className="p-header flex-between">
        <button className="icon-btn" onClick={() => navigate(-1)}><ChevronLeft size={28} /></button>
        <div className="p-header-info">
          <h2 className="p-header-title text-truncate">{story?.title || "Đang tải..."}</h2>
          <p className="p-header-chap">{chapTitle}</p>
        </div>
        <div style={{width: 28}}></div>
      </header>

      {/* Main Content: Lyrics View */}
      <div className="p-lyrics-container" ref={scrollRef}>
        <div className="p-lyrics-list" style={{fontSize: `${fontSize}px`, fontFamily: fontFamily}}>
          <div className="p-lyrics-spacer"></div>
          {sentences.map((text, idx) => (
            <div 
              key={idx} 
              className={`sentence-item ${idx === sentenceIndex ? 'active' : ''}`}
              onClick={() => jumpToSentence(idx)}
            >
              {text}
            </div>
          ))}
          <div className="p-lyrics-spacer-bottom"></div>
        </div>
      </div>

      {/* Bottom Glass Control Panel */}
      <div className="p-bottom-panel">
        {/* Navigation Controls */}
        <div className="p-main-controls flex-center">
          <button className="p-sub-btn" onClick={() => jumpToSentence(Math.max(0, sentenceIndex - 5))}><RotateCcw size={24} /></button>
          <button className="p-sub-btn" onClick={prevChapter}><SkipBack size={28} fill="currentColor" /></button>
          <button className="p-play-btn-large flex-center" onClick={togglePlay}>
            {isPlaying ? <Pause size={32} fill="white" /> : <Play size={32} fill="white" style={{marginLeft:4}} />}
          </button>
          <button className="p-sub-btn" onClick={nextChapter}><SkipForward size={28} fill="currentColor" /></button>
          <button className="p-sub-btn" onClick={() => jumpToSentence(Math.min(sentences.length-1, sentenceIndex + 5))}><RotateCw size={24} /></button>
        </div>

        {/* Function Tabs */}
        <div className="p-function-tabs flex-between">
          <button className="p-func-btn" title="Hẹn giờ"><Timer size={20} /></button>
          <button className="p-func-btn" onClick={() => setShowSettings(true)} style={{fontSize:12, fontWeight:'bold'}}>{rate}x</button>
          <button className="p-func-btn" onClick={() => navigate('/')}><Power size={20} /></button>
          <button className="p-func-btn" onClick={() => setShowSidebar(true)}><Menu size={20} /></button>
          <button className="p-func-btn" onClick={() => setShowSettings(true)}><Settings size={20} /></button>
        </div>
      </div>

      {/* Sidebar Chương */}
      {showSidebar && (
        <div className="p-sidebar-overlay" onClick={() => setShowSidebar(false)}>
          <div className="p-sidebar" onClick={e => e.stopPropagation()}>
            <div className="p-sidebar-header flex-between">
              <h3>Chương truyện</h3>
              <button onClick={() => setShowSidebar(false)}><X size={24} /></button>
            </div>
            <div className="p-sidebar-list">
              {story?.chaptersData?.map((chap, idx) => (
                <div key={idx} className={`p-sidebar-item ${idx === chapterIndex ? 'active' : ''}`} onClick={() => { setChapterIndex(idx); setSentenceIndex(0); setShowSidebar(false); }}>
                  {chap.chapterTitle}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal premium-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle"></div>
            <h3 className="settings-title">Tùy chỉnh</h3>
            
            <div className="settings-section">
              <h4>Âm thanh</h4>
              <div className="settings-group">
                <label>Nguồn: <b>{audioSource === 'google' ? 'Google Dịch' : 'Hệ thống'}</b></label>
                <div className="flex-gap">
                  <button className={`toggle-btn ${audioSource === 'system' ? 'active' : ''}`} onClick={() => setAudioSource('system')}>Hệ thống</button>
                  <button className={`toggle-btn ${audioSource === 'google' ? 'active' : ''}`} onClick={() => setAudioSource('google')}>Google</button>
                </div>
              </div>
              <div className="settings-group">
                <label>Tốc độ: <b>{rate}x</b></label>
                <input type="range" min="0.5" max="2" step="0.1" value={rate} onChange={e => setRate(parseFloat(e.target.value))} className="p-slider" />
              </div>
            </div>

            <div className="settings-section">
              <h4>Giao diện</h4>
              <div className="settings-group">
                <label>Cỡ chữ: <b>{fontSize}px</b></label>
                <div className="flex-between">
                  <button className="font-btn" onClick={() => setFontSize(Math.max(14, fontSize-2))}>A-</button>
                  <input type="range" min="14" max="32" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} className="p-slider" style={{flex:1, margin:'0 15px'}} />
                  <button className="font-btn" onClick={() => setFontSize(Math.min(32, fontSize+2))}>A+</button>
                </div>
              </div>
              <div className="settings-group">
                <label>Kiểu chữ</label>
                <div className="flex-gap">
                  <button className={`toggle-btn ${fontFamily === 'serif' ? 'active' : ''}`} style={{fontFamily:'serif'}} onClick={() => setFontFamily('serif')}>Có chân</button>
                  <button className={`toggle-btn ${fontFamily === 'sans-serif' ? 'active' : ''}`} style={{fontFamily:'sans-serif'}} onClick={() => setFontFamily('sans-serif')}>Không chân</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
