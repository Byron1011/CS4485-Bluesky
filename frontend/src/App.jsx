import './App.css';
import MapView from './components/MapView';
import FilterBar from './components/FilterBar';
import PostList from './components/PostList';

// will depreciate, working on using dynamic data
// import postsData from './data/posts.json';


import { useState, useMemo, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { FaBars } from 'react-icons/fa';

// This is a dummy page to show the router can show a different view
function About() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Test Page</h1>
      {/* PIRATE IPSUM because why not*/}
      <p>Prow scuttle parrel provost Sail ho shrouds spirits boom mizzenmast yardarm. Pinnace holystone mizzenmast quarter crow's nest nipperkin grog yardarm hempen halter furl. Swab barque interloper chantey doubloon starboard grog black jack gangway rutters.</p>
      <Link to="/">Go back to Dashboard</Link>
    </div>
  );
}

// Given a list of posts, show them (with heatmap, )
function Dashboard() {
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [filters, setFilters] = useState({ type: '', location: '', timeWindowHours: '' });

  // New stuff, for use in dynamically loading data (rather than reading from JSON file)
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // fetch posts from backend
  useEffect(() => {
    async function fetchPosts() {
      try {
        const res = await fetch("/posts"); // same origin request to backend
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        console.log(data.results);

        setPosts(data.results || []);
      } catch (err) {
        console.error("Failed to load posts:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
  }, []);


  const filteredPosts = useMemo(() => {
    let arr = posts;
    if (filters.type) arr = arr.filter(p => (p.disasterType || '').toLowerCase() === filters.type.toLowerCase());
    if (filters.location) arr = arr.filter(p => `${p.text || ''} ${p.username || ''}`.toLowerCase().includes(filters.location.toLowerCase()));
    if (filters.timeWindowHours) {
      const cutoff = Date.now() - Number(filters.timeWindowHours) * 60 * 60 * 1000;
      arr = arr.filter(p => Number.isFinite(Date.parse(p.createdAt)) && Date.parse(p.createdAt) >= cutoff);
    }
    if (search.trim()) {
      arr = arr.filter(p =>
        (p.username || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.text || "").toLowerCase().includes(search.toLowerCase())
      );
    }
    return arr;
  }, [posts, filters, search]);

  // updated to fit with post schema
  const heat = useMemo(() => (
    filteredPosts
      .filter(p => Array.isArray(p.coordinates) && p.coordinates.length > 0)
      .flatMap(p =>
        p.coordinates
          .filter(coord =>
            Array.isArray(coord) &&
            coord.length === 2 &&
            coord.every(n => typeof n === "number" && !isNaN(n))
          )
          .map(([lon, lat]) => [lat, lon, 1]) // format for Leaflet heat
      )
  ), [filteredPosts]);

  // define posts that should be displayed on the map, not all of them will,
  // and some may have multiple pins because their location was ambiguous
console.log("Raw filteredPosts sample:", filteredPosts.length, filteredPosts.slice(0, 2));


  const postsForMap = filteredPosts.flatMap(p => {

    

    if (!Array.isArray(p.coordinates) || !p.coordinates.length) return [];
    return p.coordinates
      .filter(coord => Array.isArray(coord) && coord.length === 2)
      .map(([lon, lat], i) => ({
        ...p,
        id: `${p.postId}-${i}`,   // unique id per coordinate
        lat,
        lng: lon,
      }));
  });

  // CHECK IF LOADING POSTS WORKED OR NOT
  if (loading) return <p style={{ padding: 20 }}>Loading posts...</p>;
  if (error) return <p style={{ padding: 20, color: "red" }}>Error loading posts: {error}</p>;


  return (
    <div className="app">
      <header>
        <h1 className="page-title">Crisis & Disaster Dashboard</h1>
        <nav>
          <Link to="/about">About</Link>
        </nav>
      </header>

      <button className="btn filter-toggle" onClick={() => setFiltersOpen(o => !o)}>
        <FaBars size={18} />
      </button>

      <aside className={`filterpanel ${filtersOpen ? 'open' : ''}`}>
        <div className="filterpanel-header">
          <h2 style={{ margin: 0, fontSize: 16 }}>Filters</h2>
          <button className="btn" onClick={() => setFiltersOpen(false)}>Close</button>
        </div>
        <FilterBar onApply={(vals) => {
          setFilters({
            type: vals?.type || '',
            location: vals?.location || '',
            timeWindowHours: vals?.timeWindowHours || ''
          });
          setFiltersOpen(false);
        }} />
      </aside>

      {filtersOpen && <div className="overlay" onClick={() => setFiltersOpen(false)} />}

      <section className="main-grid">
        <div className="main-grid-left">
          <input type="text" placeholder="Search messages..." value={search} onChange={e => setSearch(e.target.value)} className="search" />
          <PostList posts={filteredPosts} selectedPostId={selectedPostId} onSelectPost={setSelectedPostId} />
        </div>
        <div className="main-grid-right">

          { console.log("postsForMap being passed to MapView:", postsForMap.length, postsForMap.slice(0, 2)) }

          <MapView
            heat={heat}
            posts={postsForMap}
            selectedPostId={selectedPostId}
            onSelectPost={setSelectedPostId}
          />
        </div>
      </section>
    </div>
  );

}


// Router handles showing different views
export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </Router>
  );
}
