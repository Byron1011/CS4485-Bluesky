import { NavLink } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import logoUrl from '../assets/logo.png';

export default function Topbar() {
  const loc = useLocation();
  
  return (
    <header className="topbar">
      <div className= "topbar-inner">
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
          to="/analytics"
          className={({ isActive }) => `toplink ${isActive ? 'active' : ''}`}
        >
          Analytics
        </NavLink>
      </nav>

      <div className="topbar-right">
        {/* right side controls */}
      </div>
      </div>
    </header>
  );
}
