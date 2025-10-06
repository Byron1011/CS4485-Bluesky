import { useEffect, useRef } from 'react';

export default function PostList({ posts = [], selectedPostId = null, onSelectPost }) {
  const selectedElRef = useRef(null);

  useEffect(() => {
    if (selectedElRef.current) {
      selectedElRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedPostId]);

  if(!posts.length){
      return <div className="post-empty">No posts yet.</div>;
  }

  return (
    <div className="posts">
      {posts.map((p) => {
        const isSelected = p.id === selectedPostId;
        return (
          <article
            key={p.id}
            id={`post-${p.id}`}
            className={`post ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelectPost?.(p.id)}
            ref={isSelected ? selectedElRef : null}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectPost?.(p.id)}
            aria-pressed={isSelected}
          >
            <div className="post-user">{p.username}</div>
            <div className="post-text" style={{ margin: '6px 0' }}>
              {p.text}
            </div>
            <div className="post-meta">
              {p.disasterType} — {new Date(p.createdAt).toLocaleString()}
              {p.url ? ' — ' : ''}
              {p.url ? (
                <a href={p.url} target="_blank" rel="noreferrer">
                  View
                </a>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}