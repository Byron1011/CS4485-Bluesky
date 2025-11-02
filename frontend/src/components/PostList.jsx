import { useEffect, useRef } from 'react';

export default function PostList({ posts = [], selectedPostId = null, onSelectPost, onShowResources }) {
  const selectedElRef = useRef(null);

  useEffect(() => {
    if (selectedElRef.current) {
      selectedElRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedPostId]);

  if (!posts.length) {
    return <div className="post-empty">No posts found. Try different filters!</div>;
  }

  return (
    <div className="posts">
      {posts.map((p) => {
        const isSelected = p.id === selectedPostId;

        // Show "Other" when disasterType is empty/whitespace
        const typeLabel = (p.disasterType || '').trim() || 'Other';

        // date formatting
        const ts = Date.parse(p.createdAt);
        const when = Number.isFinite(ts) ? new Date(ts).toLocaleString() : '';

        const toggle = () => onSelectPost?.(isSelected ? null : p.id);

        return (
          <article
            key={p.id}
            id={`post-${p.id}`}
            className={`post ${isSelected ? 'selected' : ''}`}
            onClick={toggle}
            ref={isSelected ? selectedElRef : null}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
              }
            }}
            aria-pressed={isSelected}
          >
            <div className="post-user">{p.username || 'unknown'}</div>

            <div className="post-text" style={{ margin: '6px 0' }}>
              {p.text}
            </div>

            <div className="post-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>
                {typeLabel}{when ? ` — ${when}` : ''}
                {p.url ? ' — ' : ''}
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noreferrer">
                    View
                  </a>
                ) : null}
              </span>

              {/* show button on selected posts*/}
              {isSelected && (
                <button
                  className="chip chip-cta"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowResources?.(p);
                  }}
                  title="View nearby resources"
                  aria-label="View nearby resources"
                >
                  View Nearby Help
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}