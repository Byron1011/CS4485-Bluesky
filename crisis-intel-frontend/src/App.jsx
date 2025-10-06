import './App.css';
import MapView from './components/MapView';
import FilterBar from './components/FilterBar';
import PostList from './components/PostList';
import postsData from './data/posts.json'
import { useState, useMemo } from 'react';
import { FaBars } from 'react-icons/fa';

export default function App() {
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);

  const [filters, setFilters] = useState({
    type: '',
    location: '',
    timeWindowHours: ''
  });

  // Filter posts by type, location (substring), and time window
  const filteredPosts = useMemo(() => {
    let arr = postsData;

  // type filter
    if (filters.type) {
      const want = filters.type.toLowerCase();
      arr = arr.filter(p => (p.disasterType || '').toLowerCase() === want);
    }

  // location filter
    if (filters.location) {
      const q = filters.location.toLowerCase();
      arr = arr.filter(p => {
        const haystack = `${p.text || ''} ${p.username || ''} ${p.disasterType || ''}`.toLowerCase();
        return haystack.includes(q);
        }
      );
    }

  // time window filter
    if (filters.timeWindowHours) {
      const hours = Number(filters.timeWindowHours);
      const cutoff = Date.now() - hours * 60 * 60 * 1000;
      arr = arr.filter(p => {
        const t = Date.parse(p.createdAt);
        return Number.isFinite(t) && t >= cutoff;
        }
      );
    }
  //search on filtered posts
  if (search.trim()) {
    const q = search.toLowerCase();
    arr = arr.filter(p =>
      (p.username || "").toLowerCase().includes(q) ||
      (p.text || "").toLowerCase().includes(q)
      
    );
  }

  return arr;
  }, [filters, search]);

  // Heat uses filtered posts
  const heat = useMemo(() => (
    filteredPosts
      .filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
      .map(p => [p.latitude, p.longitude, 1])
  ), [filteredPosts])

  return (
    <div className="app">
      <h1 className="page-title">Crisis & Disaster Dashboard</h1>

      <button
        className="btn filter-toggle"
        onClick={() => setFiltersOpen(o => !o)}
        aria-controls="filter-panel"
        aria-expanded={filtersOpen}
        aria-label="Open filters"
      >
        <FaBars size={18} />
      </button>

      <aside
        id="filter-panel"
        className={`filterpanel ${filtersOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
      >
        <div className="filterpanel-header">
          <h2 style={{ margin: 0, fontSize: 16 }}>Filters</h2>
          <button className="btn" onClick={() => setFiltersOpen(false)}>Close</button>
        </div>

        <FilterBar
          onApply={(vals) => {setFilters({ 
            type: vals?.type || '', 
            location: vals?.location || '',
            timeWindowHours: vals?.timeWindowHours || ''});
          setFiltersOpen(false);}}/>
        </aside>

      {filtersOpen && <div className="overlay" onClick={() => setFiltersOpen(false)} />}

      {/*left = posts, right=map*/}
      <section className="main-grid">
        <div className="main-grid-left">
          <h2 className="section-title">
            BlueSky Posts
          </h2>

          <div className="container">
            <input
              type="text"
              placeholder="Search messages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search"
              aria-label="Search posts"
            />
          </div>
          
          <div className="posts-scroll">
            <PostList
              posts={filteredPosts}
              selectedPostId={selectedPostId}
              onSelectPost={setSelectedPostId}
            />
          </div>
        </div>
        <div className="main-grid-right">
          <MapView 
            heat ={heat}
            posts = {filteredPosts}
            selectedPostId = {selectedPostId}
            onSelectPost = {setSelectedPostId} 
          />
        </div>
      </section>
    </div>
  );
}