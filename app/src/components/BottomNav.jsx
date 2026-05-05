import { NavLink } from 'react-router-dom';
import { Home, Download, Headphones } from 'lucide-react';
import './BottomNav.css';

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Home size={24} />
        <span>Trang chủ</span>
      </NavLink>
      <NavLink to="/reader" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <div className="play-btn">
          <Headphones size={24} color="white" />
        </div>
        <span>Truyện đang đọc</span>
      </NavLink>
      <NavLink to="/reader" state={{ forceSearch: true }} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Download size={24} />
        <span>Tải truyện</span>
      </NavLink>
    </nav>
  );
}
