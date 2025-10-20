import { useEffect, useRef } from 'react';



export default function PostList({ posts = [], selectedPostId = null, onSelectPost, onShowResources }) {
  const selectedElRef = useRef(null);

  useEffect(() => {
    if (selectedElRef.current) {
      selectedElRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedPostId]);

  if (!posts.length) {
    return <div className="post-empty">No posts yet.</div>;
  }


  return (
    <div className="posts">
      {posts.map((p) => {


        const isSelected = p.id === selectedPostId;
        // used to tell if the client has rated the post positive or negatively (or not at all)
        p.ratedPositive = false;
        p.ratedNegative = false;


        // Show "Other" when disasterType is empty/whitespace
        const typeLabel = (p.disasterType || '').trim() || 'Other';

        // date formatting
        const ts = Date.parse(p.createdAt);
        const when = Number.isFinite(ts) ? new Date(ts).toLocaleString() : '';

        const toggle = () => onSelectPost?.(isSelected ? null : p.id);

        if (!Object.hasOwn(p, "userRating")) {
          p.userRating = Math.floor(Math.random() * 11) - 5;
        }





        return (
          <article
            key={p.id}
            id={`post-${p._id}`}
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
            <div className="post-user" style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>{p.username || 'unknown'}

              <span class="review-buttons">
                <button class="positive-review-btn" pid={p.id} onClick={
                  (event) => {
                    const button = event.target;

                    const parent = button.parentElement; // <span class="review-buttons">
                    const negativeBtn = parent.querySelector(".negative-review-btn");

                    if (p.ratedNegative) {
                      p.userRating += 1;
                    }

                    const pid = button.getAttribute("pid");


                    button.classList.toggle("clicked");
                    p.ratedPositive = !p.ratedPositive;

                    if (p.ratedPositive) {
                      button.style.backgroundColor = "grey";

                      p.ratedNegative = false;
                      negativeBtn.style.backgroundColor = "red";

                      p.userRating += 1;

                    } else {
                      button.style.backgroundColor = "green";
                      p.userRating -= 1;
                    }

                    const ratingTag = document.querySelector(".rating-tag");
                    // Rebuild tag depending on new value
                    if (p.userRating > 0) {
                      ratingTag.innerHTML = `<span style="color: green; font-weight: bold;">
    Reviewed by ${p.userRating} users
  </span>`;
                    } else if (p.userRating < 0) {
                      ratingTag.innerHTML = `<span style="color: red; font-weight: bold;">
    Reported by ${Math.abs(p.userRating)} users
  </span>`;
                    } else {
                      ratingTag.innerHTML = ""; // reset to empty if neutral
                    }

                    event.preventDefault();
                    event.stopPropagation();
                  }
                } style={{ display: "flex", flexDirection: "row", alignItems: "center", backgroundColor: "green", height: "10px" }}>
                  &#128077;
                </button>

                <button class="negative-review-btn" pid={p.id} onClick={
                  (event) => {
                    const button = event.target;

                    const parent = button.parentElement; // <span class="review-buttons">
                    const positiveBtn = parent.querySelector(".positive-review-btn");


                    const pid = button.getAttribute("pid");

                    if (p.ratedPositive) {
                      p.userRating -= 1;
                    }

                    button.classList.toggle("clicked");
                    p.ratedNegative = !p.ratedNegative;

                    if (p.ratedNegative) {
                      button.style.backgroundColor = "grey";


                      p.ratedPositive = false;
                      positiveBtn.style.backgroundColor = "green";

                      p.userRating -= 1;

                    } else {
                      button.style.backgroundColor = "red";
                      p.userRating += 1;
                    }

                    // get rating tag and update
                    const ratingTag = document.querySelector(".rating-tag");
                    // Rebuild tag depending on new value
                    if (p.userRating > 0) {
                      ratingTag.innerHTML = `<span style="color: green; font-weight: bold;">
    Reviewed by ${p.userRating} users
  </span>`;
                    } else if (p.userRating < 0) {
                      ratingTag.innerHTML = `<span style="color: red; font-weight: bold;">
    Reported by ${Math.abs(p.userRating)} users
  </span>`;
                    } else {
                      ratingTag.innerHTML = ""; // reset to empty if neutral
                    }

                    event.preventDefault();
                    event.stopPropagation();
                  }
                } style={{ display: "flex", flexDirection: "row", alignItems: "center", backgroundColor: "red", height: "10px" }} >
                  &#x1F44E;
                </button>
              </span>


            </div>

            <div className="post-text" style={{ margin: '6px 0' }}>
              {p.text}
            </div>

            <div className="post-meta" style={{ display: 'flex', justifyContent: "space-between", alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>
                {typeLabel}{when ? ` — ${when}` : ''}
                {p.url ? ' — ' : ''}
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noreferrer">
                    View
                  </a>
                ) : null}
              </span>

              <span class="rating-tag">
                {p.userRating > 0 && (
                  <span style={{ color: 'green', fontWeight: 'bold' }}>Verified by {p.userRating} users</span>
                )}
                {p.userRating < 0 && (
                  <span style={{ color: 'red', fontWeight: 'bold' }}>Reported by {p.userRating * -1} users</span>
                )}
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
                  View resources
                </button>
              )}



            </div>
          </article>
        );
      })}
    </div>
  );
}