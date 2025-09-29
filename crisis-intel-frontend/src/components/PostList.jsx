export default function PostList({posts = []}) {
if(!posts.length){
    return <div className="post-empty">No posts yet.</div>;
}

  return (
    <div className="posts">
      {posts.map(p => (
        <article key={p.id} className="post">
          <div className="post-user">
            {p.username}
            </div>
          <div className="post-text" style={{margin: '6px 0'}}>
            {p.text}
            </div>
          <div className="post-meta">
            {p.disasterType} - {new Date(p.createdAt).toLocaleString()}
            {p.url ? ' - ' : ''}
            {p.url ? <a href={p.url} target="_blank" rel="noreferrer">View</a> : ''}
            </div>
        </article>
      ))}
    </div>
  );
}