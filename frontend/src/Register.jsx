import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import logoUrl from "./assets/logo.png";
import { useNotifications } from "./NotificationContext";

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

export default function Register() {
  useEnsureTheme();
  const { register } = useAuth();
  const nav = useNavigate();
  const { notify } = useNotifications();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e) {
    e.preventDefault();

    try {
      await register(username, password);

      // notify success
      notify({
        type: "success",
        text: "Account created successfully! Please log in."
      });

      // redirect
      nav("/login");

    } catch (e) {
      notify({
        type: "error",
        text: e.message || "Registration failed."
      });
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-split">
        {/* left: Media card */}
        <section className="auth-media-card">
          <div className="auth-media-title">Create your account</div>
          <div
            id="register-img"
            className="auth-media"
            style={{ backgroundImage: 'url("/register.png")' }}
            aria-label="Register illustration"
          />
        </section>

        {/* right: Form card */}
        <section className="auth-form-card">
          <h1 className="auth-title">Register</h1>
          <p className="auth-subtitle">Start using the Crisis &amp; Disaster Dashboard</p>

          <form className="auth-form" onSubmit={onSubmit}>
            <div className="auth-row">
              <label className="auth-label" htmlFor="username">Username</label>
              <input
                id="username"
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
                autoComplete="new-password"
                required
              />
            </div>

            <div className="btn-group" style={{ marginTop: 4 }}>
              <button type="submit" className="btn btn--md btn--primary">Create account</button>
            </div>
          </form>

          <div className="auth-ctas">
            <div>
              <span className="auth-subtitle" style={{ marginRight: 6 }}>Already have an account?</span>
              <Link to="/login" className="link-quiet">Log in</Link>
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