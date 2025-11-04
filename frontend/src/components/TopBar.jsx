import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import logoUrl from '../assets/logo.png';

export default function Topbar() {
  const loc = useLocation();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  
  return (
    <header className="topbar">
      <div className= "topbar-inner">
      <div className="topbar-left">
        {/* left Logo and name */}
        <img src={logoUrl} alt="BlueSky Crisis Intel logo" className="logo-img" />
        {/*Title*/}
        <div className="brand">BlueSky Crisis Intel</div>
      </div>

      {/* center main navigation */}
      <nav className="topbar-nav">
        <NavLink
          to="/dashboard"
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

      {/* right: user login/out register */}
      <div className="topbar-right">
        {user ? (
            <>
              <Link
                to="/user"
                className="btn btn--md btn--ghost"
                title="User page"
              >
                {user.username}
              </Link>

              <button
                type="button"
                className="btn btn--md btn--primary"
                onClick={async () => {
                  await logout();
                  nav('/login');
                }}
                title="Logout"
              >
                Logout
              </button>

              {user.role !== 'guest' && (
                <Link to="/protected" className="btn btn--md btn--ghost">
                  Protected
                </Link>
              )}
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn--md btn--ghost">
                Login
              </Link>
              <Link to="/register" className="btn btn--md btn--primary">
                Register
              </Link>
            </>
          )}
      </div>
      </div>
    </header>
  );
}

