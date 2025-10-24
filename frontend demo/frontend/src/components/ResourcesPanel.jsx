import React from 'react';

export default function ResourcesPanel({
  open,
  loading,
  error,
  resources,
  onClose,
}) {
  if (!open) return null;

  return (
    <div className="resources-panel" role="region" aria-label="Nearby resources">
      <div className="resources-head">
        <div className="resources-title">
          Resources near this post
          <span className="resources-sub"> (within ~10 miles)</span>
        </div>
        <button
          className="chip"
          onClick={onClose}
          aria-label="Close resources panel"
          title="Close"
        >
          ✕
        </button>
      </div>

      {loading && (
        <div className="resources-status">
          <span className="spinner" aria-label="Loading" /> Loading…
        </div>
      )}

      {error && !loading && (
        <div className="error-card" role="alert" style={{ margin: 0 }}>
          {error}
        </div>
      )}

      {!loading && !error && resources.length === 0 && (
        <div className="resources-empty">No nearby resources found.</div>
      )}

      {!loading && !error && resources.length > 0 && (
        <ul className="resources-list">
          {resources.map((r) => (
            <li key={r.id} className="resources-item">
              <div className="ri-top">
                <div className="ri-name">
                  {r.website ? (
                    <a href={r.website} target="_blank" rel="noreferrer">
                      {r.name}
                    </a>
                  ) : (
                    r.name
                  )}
                </div>
                {Number.isFinite(r.miles) && (
                  <div className="ri-distance">{r.miles.toFixed(1)} mi</div>
                )}
              </div>
              <div className="ri-meta">
                {r.type || 'resource'}
                {r.city || r.state ? ' — ' : ''}
                {[r.city, r.state].filter(Boolean).join(', ')}
              </div>
              <div className="ri-meta">
                {r.address}
                {r.phone ? ` — ${r.phone}` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}