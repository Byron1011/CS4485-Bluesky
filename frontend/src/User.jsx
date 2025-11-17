import { useAuth } from "./AuthContext";
import logoUrl from "/src/assets/logo.png"

export default function User() {
  const { user } = useAuth();
  return (
    <div className="page">
      <div className="app">
        <main className="user-page">
          <section className="user-card">
            <h1 className="user-title">Your Account</h1>
            <p className="user-sub">Manage profile and settings</p>
            <p className="auth-subtitle">Profile overview</p>
            {user ? (
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li><strong>Username:</strong> {user.username}</li>
                <li><strong>Role:</strong> {user.role}</li>
              </ul>
            ) : (
              <div className="error-card">Not signed in.</div>
            )}
          </section>
        </main>

        <section className="site-footer">
          <img src={logoUrl} alt="Blue Sky Crisis Intel" className="footer-logo" />
          <div className="footer-mark">Blue Sky Crisis Intel</div>
        </section>
      </div>
    </div>
  );
}
