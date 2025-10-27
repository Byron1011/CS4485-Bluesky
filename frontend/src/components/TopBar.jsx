import { NavLink } from 'react-router-dom';
import { Link, useLocation } from 'react-router-dom';

export default function Topbar({ lastUpdated, onRefresh }) {
  const loc = useLocation();
  const isActive = (path) =>
    loc.pathname === path ? { background: '#eef4ff', borderRadius: 8 } : {};

  return (
    <header className="topbar">
      <div className="topbar-left">
        {/* Logo */}
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