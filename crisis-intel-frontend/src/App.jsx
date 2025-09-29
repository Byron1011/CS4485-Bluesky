import './App.css';
import MapView from './components/MapView';
import FilterBar from './components/FilterBar';
import PostList from './components/PostList';
import postsData from './data/posts.json'
import { useState } from 'react';
import { FaBars } from 'react-icons/fa';

export default function App() {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const heat = postsData
    .filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    .map(p => [p.latitude, p.longitude, 1]);

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

        <FilterBar onApply={() => setFiltersOpen(false)} />
      </aside>

      {filtersOpen && <div className="overlay" onClick={() => setFiltersOpen(false)} />}

      {/*left = posts, right=map*/}
      <section className="main-grid">
        <div className="main-grid-left">
          <h2 className="section-title">
            BlueSky Posts
          </h2>
          <PostList posts={postsData} />
        </div>
        <div className="main-grid-right">
          <MapView heat ={heat} />
        </div>
      </section>
    </div>
  );
}