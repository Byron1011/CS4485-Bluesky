import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import logoUrl from "./assets/logo.png";

/*keep dark mode*/
function useEnsureTheme() {
    useEffect(() => {
        const cookie = document.cookie || "";
        const isDark = /(?:^|;\s*)dark_theme=true(?:;|$)/.test(cookie);
        const root = document.documentElement;
        if (isDark) root.classList.add("dark-theme");
        else root.classList.remove("dark-theme");
    }, []);
}

export default function Login() {
  useEnsureTheme();
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const flash = location.state?.flash;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      await login(username, password);
      nav("/dashboard");
    } catch (e) {
      setErr(e.message || "Login failed");
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-split">
        {/* LEFT: Media card (boxed) */}
        <section className="auth-media-card">
          <div className="auth-media-title">Welcome back</div>
          <div
            id="login-img"
            className="auth-media"
            style={{ backgroundImage: 'url("/login.png")' }}
            aria-label="Login illustration"
          />
        </section>

        {/* RIGHT: Form card (boxed) */}
        <section className="auth-form-card">
          <h1 className="auth-title">Login</h1>
          <p className="auth-subtitle">Sign in to access full dashboard, or continue using as Guest</p>

          {flash && flash.type === "success" && (
            <div className="flash-card flash-card--success">
              {flash.text}
            </div>
          )}

          {err ? <div className="error-card">{String(err)}</div> : null}

          <form className="auth-form" onSubmit={onSubmit}>
            <div className="auth-row">
              <label className="auth-label" htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                className="auth-input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="auth-row">
              <label className="auth-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="auth-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <div className="btn-group" style={{ marginTop: 4 }}>
              <button type="submit" className="btn btn--md btn--primary">Login</button>
            </div>
          </form>

          <div className="auth-ctas">
            <div>
              <span className="auth-subtitle" style={{ marginRight: 6 }}>No account?</span>
              <Link to="/register" className="link-quiet">Create one</Link>
            </div>
          </div>
        </section>
      </div>

      <div className="auth-logo-wrap">
        <img src={logoUrl} alt="BlueSky Crisis Intel logo" className="auth-logo" />
      </div>
    </div>
  );
}
