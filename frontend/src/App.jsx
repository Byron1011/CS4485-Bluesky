import './App.css';
import MapView from './components/MapView';
import PostList from './components/PostList';
import FilterBar from './components/FilterBar';
import Topbar from './components/TopBar';
import SummaryBar from './components/SummaryBar';
import DateRangePicker from './components/DateRangePicker';
import ResourcesPanel from './components/ResourcesPanel';
import Analytics from './components/Analytics';
import Cookies from 'js-cookie';
import logoUrl from './assets/logo.png';

import { useState, useMemo, useEffect, useRef } from 'react';

const KNOWN_TYPES = new Set([
  'flood',
  'earthquake',
  'wildfire',
  'hurricane',
  'tornado',
  'storm',
  'heatwave',
  'landslide',
  'volcano',
  'avalanche',
  'fire',
  'explosion',
  'accident',
  'disease',
  'violence'
]);
const NON_TYPES = new Set(['', 'none', 'unknown', 'n/a', 'na', 'null']);

//normalize API rows into flat map/list items
function normalizeApiResults(apiRows) {
  const rows = Array.isArray(apiRows) ? apiRows : [];
  const out = [];
  const canon = (s) => String(s ?? '').trim().toLowerCase();

  const extractType = (r) => {
    let t =
      r?.disasterType ??
      r?.type ??
      r?.labels?.disasterType ??
      r?.labels?.type ??
      r?.labels?.category ??
      "";

    if (t && typeof t === "object") {
      if (typeof t.name === "string" && t.name.trim()) t = t.name;
      else if (Array.isArray(t) && t.length && typeof t[0] === "string") t = t[0];
      else t = String(t);
    }

    const raw = String(t ?? '').trim();
    const low = canon(raw);
    if (NON_TYPES.has(low)) return "";
    if (!KNOWN_TYPES.has(low)) return "";
    return raw;
  };

  const extractUser = (r) => {
    const s = (v) => (typeof v === 'string' && v.trim()) ? v.trim() : '';
    return s(r?.author) ||
         s(r?.user?.handle) ||
         s(r?.author?.handle) ||
         s(r?.username) ||
         '';
  };

  for (const r of rows) {
    const disasterType = extractType(r);
    const coords = Array.isArray(r?.coordinates) ? r.coordinates : [];

    if (!coords.length) {
      out.push({
        id: r.postId,
        postId: r.postId,
        username: extractUser(r),
        text: r.text ?? "",
        disasterType,
        createdAt: r.createdAt,
        lat: undefined,
        lng: undefined,
        url: ""
      });
      continue;
    }

    //coordinates are [lat, lon]
    coords.forEach((pair, i) => {
      if (!Array.isArray(pair) || pair.length < 2) return;
      const lat = Number(pair[0]);
      const lon = Number(pair[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return;

      out.push({
        id: `${r.postId}:${i}`,
        postId: r.postId,
        username: extractUser(r),
        text: r.text ?? "",
        disasterType,
        createdAt: r.createdAt,
        lat,
        lng: lon,
        url: ""
      });
    });
  }

  return out;
}

function timeWindowLabel(h) {
  if (!h) return 'Any time';
  const n = Number(h);
  if (!Number.isFinite(n) || n <= 0) return 'Any time';
  if (n === 24) return 'Past 24 hours';
  if (n === 48) return 'Past 48 hours';
  if (n === 72) return 'Past 72 hours';
  return `Past ${n} hours`;
}

// date label helper for summary
function fmtDate(dStr) {
  if (!dStr) return '';
  const d = new Date(dStr + 'T00:00:00');
  return d.toLocaleDateString();
}
function dateRangeLabel(from, to) {
  if (!from && !to) return 'Any dates';
  if (from && to) return `${fmtDate(from)} – ${fmtDate(to)}`;
  if (from) return `From ${fmtDate(from)}`;
  return `Until ${fmtDate(to)}`;
}

//fetch every post on page
async function fetchAllPosts({ withCoords = false } = {}) {
  const PAGE_SIZE = 200;
  const MAX_PAGES = 20;
  let page = 1;
  const all = [];
  let total = null;

  while (page <= MAX_PAGES) {
    const url = `/posts?page=${page}&pageSize=${PAGE_SIZE}${withCoords ? '&withCoords=1' : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const batch = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
    if (typeof data.total === 'number' && data.total >= 0) total = data.total;

    all.push(...batch);

    if (batch.length < PAGE_SIZE) break; // last page
    page += 1;
  }

  return { rows: all, total: total ?? all.length };
}

function milesBetween(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const Rm = 3958.7613;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Rm * c;
}

function Dashboard() {
  // UI state
  const [search, setSearch] = useState("");
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [darkTheme, setDarkTheme] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    types: [],
    timeWindowHours: '',
    dateFrom: '',    // 'YYYY-MM-DD'
    dateTo: ''       
  });

  // Data
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);

  const [missingPost, setMissingPost] = useState(null);

  const [toast, setToast] = useState('');
  const toastTimerRef = useRef(null);
  const showToast = (msg, ms = 2400) => {
    setToast(String(msg || ''));
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast('');
      toastTimerRef.current = null;
    }, ms);
  };
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
  const preference = Cookies.get("dark_theme");
    if (preference === "false") {
      console.log("user prefers light theme");
      setDarkTheme(false);
    } else if (preference === "true") {
      console.log("User prefers dark theme");
      setDarkTheme(true);
    } else {
      console.log("COULD NOT GET USER PREFERENCE");
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark-theme', darkTheme);
  }, [darkTheme]);

  const toggleTheme = () => {
    // set cookie so preference is remembered
    var pref = "true";
    if (darkTheme) { // switch to false
      pref = "false";
    }
    Cookies.set("dark_theme", pref, {
      expires: 365,
      path: "/"
    });
    console.log("preference changed");
    // change state
    setDarkTheme(!darkTheme);
  };

  // fetch ALL posts on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { rows, total } = await fetchAllPosts({ withCoords: false });
        const normalized = normalizeApiResults(rows);

        if (!cancelled) {
          setPosts(normalized);
          setTotal(total);
        }
      } catch (err) {
        console.error('Failed to load posts:', err);
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // dynamic type options from data
  const allTypes = useMemo(() => {
    return Array.from(
      new Set(
        posts
          .map(p => String(p.disasterType || '').trim())
          .filter(t => t && KNOWN_TYPES.has(t.toLowerCase()))
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [posts]);

  // filter pipeline
  const filteredPosts = useMemo(() => {
    let arr = posts;

    // type chips
    if (filters.types?.length) {
      const want = new Set(filters.types.map(t => t.toLowerCase()));
      arr = arr.filter(p => want.has((p.disasterType || '').toLowerCase()));
    }

    // time-window (hours back)
    if (filters.timeWindowHours) {
      const cutoff = Date.now() - Number(filters.timeWindowHours) * 60 * 60 * 1000;
      arr = arr.filter(p => {
        const t = Date.parse(p.createdAt);
        return Number.isFinite(t) && t >= cutoff;
      });
    }

    // date-range (calendar)
    if (filters.dateFrom || filters.dateTo) {
      const start = filters.dateFrom
        ? new Date(filters.dateFrom + 'T00:00:00').getTime()
        : Number.NEGATIVE_INFINITY;
      const end = filters.dateTo
        ? new Date(filters.dateTo + 'T23:59:59.999').getTime()
        : Number.POSITIVE_INFINITY;

      arr = arr.filter(p => {
        const t = Date.parse(p.createdAt);
        return Number.isFinite(t) && t >= start && t <= end;
      });
    }

    // full-text search
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(p =>
        (p.username || '').toLowerCase().includes(q) ||
        (p.text || '').toLowerCase().includes(q)
      );
    }

    return arr;
  }, [posts, filters, search]);

  const postsForMap = useMemo(
    () => filteredPosts.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    [filteredPosts]
  );

  // summary text
  const summaryText = [
    (filters.types?.length ? `Types: ${filters.types.join(', ')}` : 'Types: Any'),
    `Time: ${timeWindowLabel(filters.timeWindowHours)}`,
    `Dates: ${dateRangeLabel(filters.dateFrom, filters.dateTo)}`,
    search.trim() ? `Search: “${search.trim()}”` : null,
  ].filter(Boolean).join(' · ');

  const lastUpdated = useMemo(() => {
    const ts = Math.max(...posts.map(p => Date.parse(p.createdAt) || 0), 0);
    return ts ? new Date(ts).toLocaleString() : '';
  }, [posts]);

  const refresh = async () => {
    try {
      setLoading(true);
      const { rows, total } = await fetchAllPosts({ withCoords: false });
      const normalized = normalizeApiResults(rows);
      setPosts(normalized);
      setTotal(total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // time chip toggler
  const setTime = (h) =>
    setFilters(f => ({
      ...f,
      timeWindowHours: String(f.timeWindowHours || '') === String(h || '') ? '' : h
    }));
  const isTimeActive = (h) => String(filters.timeWindowHours || '') === String(h || '');

  // multi-select type toggler
  const toggleType = (t) =>
    setFilters(f => {
      const v = String(t || '');
      const set = new Set(f.types || []);
      if (set.has(v)) set.delete(v); else set.add(v);
      return { ...f, types: Array.from(set) };
    });
  const clearAllTypes = () => setFilters(f => ({ ...f, types: [] }));

  //date range handlers
  const setDateRange = ({ from, to }) =>
    setFilters(f => ({ ...f, dateFrom: from || '', dateTo: to || '' }));
  const clearDates = () =>
    setFilters(f => ({ ...f, dateFrom: '', dateTo: '' }));

  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [resources, setResources] = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourcesError, setResourcesError] = useState(null);

  useEffect(() => {
      setResourcesOpen(false);
      setResources([]);
      setResourcesError(null);
      setResourcesLoading(false);
  }, [selectedPostId]);

  async function fetchResourcesNear({ lat, lng, postId, radiusMi = 10 }) {
    try {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        showToast('That post has no resource locations near.');
        return;
      }
      setResourcesOpen(true);
      setResourcesLoading(true);
      setResourcesError(null);
      const res = await fetch(`/resources?long=${lng}&lat=${lat}&radius=${radiusMi}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const arrayLike = Array.isArray(data)
      ? data
      : (Array.isArray(data?.resources) ? data.resources : []);

      const mapped = arrayLike.map((r) => ({
        id: r._id || r.id,
        name: r.name || 'Unknown resource',
        type: r.type || 'resource',
        address: r.address || '',
        city: r.city || '',
        state: r.state || '',
        phone: r.phone || '',
        website: r.website || '',
        miles: r.location?.coordinates
          ? milesBetween(lat, lng, r.location.coordinates[1], r.location.coordinates[0])
          : null,
      }));

      setResources(mapped);
    } catch (err) {
      setResourcesError(err.message);
    } finally {
      setResourcesLoading(false);
    }
  }

  const closeResources = () => {
    setResourcesOpen(false);
    setResources([]);
  };

  const handleSelectPost = (id) => {
    setSelectedPostId(id);
    // if switching selection, clear any previous "missing coords" banner.
    if (id !== (missingPost?.id ?? null)) setMissingPost(null);
  };

  const onShowResourcesFromPost = (post) => {
    console.log('[onShowResourcesFromPost] post:', post);
    if (!Number.isFinite(post.lat) || !Number.isFinite(post.lng)) {
      showToast('That post has no coordinates.');
      return;
    }
    fetchResourcesNear({ lat: post.lat, lng: post.lng, postId: post.id });
  };

  if (loading) {
    return (
      <>
        <div style={{ padding: 20, display:'flex', alignItems:'center', gap:10 }}>
          <span className="spinner" aria-label="Loading" /> <span>Loading posts…</span>
        </div>
      </>
    );
  }
  if (error) {
    return (
      <>
        <div className="error-card" role="alert">
          <strong>Couldn’t load posts.</strong>
          <div style={{ marginTop: 6 }}>{String(error)}</div>
        </div>
      </>
    );
  }

  return (
  <>
    <div className="page">
      <div className="app">

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
          <label className="switch" title="Toggle dark mode">
            <input
              type="checkbox"
              checked={!!darkTheme}
              onChange={toggleTheme}
              aria-label="Toggle dark mode"
            />
            <span className="slider" />
            <span className="switch-label">{darkTheme ? 'Dark' : 'Light'}</span>
          </label>
        </div>

        <div className="onboarding-tip" role="note" aria-label="filters tip">
              Use filters to explore posts from specific disasters or dates.
        </div>

        {/* filters toolbar*/}
        <div className="filters-toolbar" role="region" aria-label="Filters">
          {/* Left: Search, Date */}
          <div className="filters-left">
            <div className="container" style={{ minWidth: 260 }}>
              <div className="search-wrap">
                <div className="search-line">
                  <span className="search-icon" aria-hidden>🔎</span>
                  <input
                    type="text"
                    placeholder="Search for keywords or locations..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="search"
                    aria-label="Search posts"
                  />
                </div>
              </div>
            </div>

            <DateRangePicker
              from={filters.dateFrom}
              to={filters.dateTo}
              onChange={setDateRange}
              onClear={clearDates}
            />
          </div>

          {/* Center: Type chips, tip */}
          <div className="filters-center">
            <FilterBar
              types={allTypes}
              values={filters.types}
              onToggle={(t) => {
                toggleType(t);
                if (missingPost) setMissingPost(null);
              }}
              onClearAll={() => {
                clearAllTypes();
                if (missingPost) setMissingPost(null);
              }}
            />
          </div>
        </div>

        {/* Right: Summary */}
        <div className="filters-right">
          <div className="filters-summary-row">
          <SummaryBar
            summaryText={summaryText}
            results={filteredPosts.length}
            total={total}
          />
          </div>
        </div>
      
        {/* postslist and map */}
        <section className="main-grid">
          {/* left posts */}
          <div className="col">
            <div className="col-top">
              <h2 className="col-title">Crisis Post Feed</h2>
            </div>

            <div className="col-body">
              <div className="list-box">
                <PostList
                  posts={filteredPosts}
                  selectedPostId={selectedPostId}
                  onSelectPost={handleSelectPost}
                  onShowResources={onShowResourcesFromPost}
                />
              </div>
            </div>
          </div>

          {/* right map */}
          <div className="col">
            <div className="col-top">
              <h2 className="col-title">Disaster Map: Posts per km<sup>2</sup></h2>
            </div>

            <div className="col-body">
              <div className="map-box">
                {/* banner on map */}
                {missingPost && selectedPostId === missingPost.id && (
                  <div className="map-notice" role="status">
                    No coordinates for this post.
                  </div>
                )}

                {/* time chips on map */}
                <div className="map-timechips" role="group" aria-label="Time window">
                  <button
                    className={`chip ${isTimeActive('') ? 'active' : ''}`}
                    onClick={() => setTime('')}
                  >
                    All
                  </button>
                  <button
                    className={`chip ${isTimeActive(24) ? 'active' : ''}`}
                    onClick={() => setTime(24)}
                  >
                    24h
                  </button>
                  <button
                    className={`chip ${isTimeActive(48) ? 'active' : ''}`}
                    onClick={() => setTime(48)}
                  >
                    48h
                  </button>
                  <button
                    className={`chip ${isTimeActive(72) ? 'active' : ''}`}
                    onClick={() => setTime(72)}
                  >
                    72h
                  </button>
                </div>

                <MapView
                  posts={filteredPosts}
                  selectedPostId={selectedPostId}
                  onSelectPost={setSelectedPostId}
                  enableLegendToggle={true}
                  onMissingCoords={(post) => setMissingPost({ id: post.id, text: post.text || '' })}
                  onHasCoords={() => { if (missingPost) setMissingPost(null); }}
                />
              </div>
            </div>
          </div>
        </section>

        <ResourcesPanel
          open={resourcesOpen}
          loading={resourcesLoading}
          error={resourcesError}
          resources={resources}
          onClose={closeResources}
        />

        <footer className="site-footer" aria-label="Footer">
          <img src={logoUrl} alt="BlueSky Crisis Intel logo" className="footer-logo" />
          <div className="footer-mark">Crisis &amp; Disaster Dashboard</div>
        </footer>

        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
      </div>
    </>
  );
}

// Router handles showing different views
export default function App() {
  return (
    <>
    <Dashboard />
    </>
  );
}
