import { NavLink } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import logoUrl from '../assets/logo.png';

export default function Topbar({ lastUpdated, onRefresh }) {
  const loc = useLocation();
  
  return (
    <header className="topbar">
      <div className="topbar-left">
        {/* Logo */}
        <img src={logoUrl} alt="BlueSky Crisis Intel logo" className="logo-img" />
        {/*Title*/}
        <div className="brand">BlueSky Crisis Intel</div>
      </div>

      <nav className="topbar-nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `toplink ${isActive ? 'active' : ''}`}
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/about"
          className={({ isActive }) => `toplink ${isActive ? 'active' : ''}`}
        >
          About
        </NavLink>
      </nav>

      <div className="topbar-right">
        {/* right side controls */}
      </div>
    </header>
  );
}