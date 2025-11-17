import { useAuth } from './AuthContext';
import logoUrl from "./assets/logo.png";

export default function Protected() {
  const { user } = useAuth();

  const isAdmin = !!user && (user.role === 'admin' || user.role === 'superadmin');

  return (
    <div className="page">
      <div className="app">
        <main className="user-page">
          <div className="user-card">
            <h2 className="user-title">Protected</h2>

            {!user && (
              <p className="user-sub">You must be signed in to view this page.</p>
            )}

            {user && !isAdmin && (
              <p className="user-sub">
                You must be signed in as an Admin to view this page.
              </p>
            )}

            {user && isAdmin && (
              <div>
                <p className="user-sub">
                  Admin access granted. Welcome, {user.username || 'admin'}.
                </p>
                <div className="list-box" style={{ marginTop: 12 }}>
                  <strong>Secret:</strong> Admin-only content appears here.
                </div>
              </div>
            )}
          </div>
        </main>

        <section className="site-footer">
          <img src={logoUrl} alt="Blue Sky Crisis Intel" className="footer-logo" />
          <div className="footer-mark">Blue Sky Crisis Intel</div>
        </section>
      </div>
    </div>
  );
}
