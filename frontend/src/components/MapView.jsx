import { useEffect, useRef } from 'react';
import { getTypeColor } from '../theme/typeColors';
import { useNotifications } from '../NotificationContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import resetIconUrl from '../assets/resetZoom.png';

const SELECTION_ZOOM = 9;
const KM_PER_DEG = 111.32;

const DENSITY = {
  RADIUS_Z4: 14,   
  RADIUS_Z12: 6,   
  BLUR_FACTOR: 0.22,  
  MINOPACITY_Z4: 0.5, 
  MINOPACITY_Z12: 0.5 
};

const SEVERITY = {
  RADIUS_Z4: 20,
  RADIUS_Z12: 30,
  BLUR_FACTOR: 0.35,
  MINOPACITY_Z4: 0.25,
  MINOPACITY_Z12: 0.35
};

const WORLD_BOUNDS = L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180));
const INITIAL_VIEW = { center: [20, 0], zoom: 2 };

// helpers
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// detectors/parsers (accept labels, numerics, alt fields)
const readSeverity = (p) => {
  const lvlRaw = (p?.severityLevel ?? p?.severity ?? p?.severity_label ?? '')
    .toString().trim().toLowerCase();
  const scoreRaw = (p?.severityScore ?? p?.severity_score ?? p?.severityValue ?? p?.severity_value ?? null);

  const missingTokens = ['none', 'unknown', 'no severity', 'no-severity', 'n/a', 'na', 'null'];

  // If the label explicitly says "no data"/"unknown", ignore
  if (lvlRaw && missingTokens.includes(lvlRaw)) {
    return null;
  }

  // If there is no label at all and no score, no severity.
  if (!lvlRaw && scoreRaw === null) {
    return null;
  }

  // Numeric score: must be finite and > 0 = "has severity"
  if (scoreRaw !== null) {
    const num = Number(scoreRaw);
    if (Number.isFinite(num) && num > 0) return { kind: 'score', value: num };
  }

  // Label mapping (explicit buckets only)
  const synonyms = {
    low: ['low', 'minor', 'green'],
    moderate: ['moderate', 'medium', 'med', 'mod', 'yellow'],
    severe: ['severe', 'high', 'critical', 'red', 'very high', 'extreme']
  };
  if (lvlRaw) {
    if (synonyms.low.includes(lvlRaw))      return { kind: 'label', value: 'low' };
    if (synonyms.moderate.includes(lvlRaw)) return { kind: 'label', value: 'moderate' };
    if (synonyms.severe.includes(lvlRaw))   return { kind: 'label', value: 'severe' };
  }

  // Numeric-looking level string: require > 0
  if (lvlRaw && /^[0-9.]+$/.test(lvlRaw)) {
    const num = Number(lvlRaw);
    if (Number.isFinite(num) && num > 0) return { kind: 'score', value: num };
  }
  return null;
};

const hasSeverity = (p) => !!readSeverity(p);

export default function MapView({
  posts = [],
  selectedPostId = null,
  onSelectPost,
  onMissingCoords,
  onHasCoords
}) {

  const { notify, remove } = useNotifications();
  const mapEl = useRef(null);
  const mapRef = useRef(null);

  const severityHintIdRef = useRef(null);
  const showSeverityHint = () => {
    // If already one, kill first so never stack
    if (severityHintIdRef.current != null) {
      remove(severityHintIdRef.current);
      severityHintIdRef.current = null;
    }

    const id = notify({
      type: 'info',
      text: 'To see Severity Better, zoom in on an area',
      duration: 0, // stays until we manually remove
    });

    severityHintIdRef.current = id;
  };
  const clearSeverityHint = () => {
    if (severityHintIdRef.current != null) {
      remove(severityHintIdRef.current);
      severityHintIdRef.current = null;
    }
  };


  // latest posts
  const postsRef = useRef(posts);
  useEffect(() => { postsRef.current = posts; }, [posts]);

  // type color cache
  const typeColorCacheRef = useRef(new Map());
  const colorForType = (type) => {
    const key = String(type || '').trim();
    if (!key) {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--marker-default')
        .trim() || '#3895ff';
    }
    const hit = typeColorCacheRef.current.get(key);
    if (hit) return hit;
    const c = getTypeColor(key);
    typeColorCacheRef.current.set(key, c);
    return c;
  };

  // panes & layers
  const markersRendererRef = useRef(null);
  const markersLayerRef = useRef(null);
  const markerByIdRef = useRef(new Map());

  const markerGroupsRef = useRef(new Map());
  const markerGroupIndexRef = useRef(new Map());

  const heatRef = useRef(null); // For density heatmap
  const severityLayerRef = useRef(null); 
  const severitySelectedLayerRef = useRef(null); // Selected severity circle (always on top)
  const severityCircleByIdRef = useRef(new Map()); // Track severity circles by post ID
  const heatConfRef = useRef({ radius: 0, blur: 0, minOpacity: 0.0 });
  const heatStatsRef = useRef({ min: 0, q50: 0, max: 0 }); // for density legend

  // mode state 
  const showMarkersRef = useRef(true);
  const showDensityRef = useRef(true);
  const showSeverityRef = useRef(true);

  const lastMetricRef = useRef(null);
  const selectedPostIdRef = useRef(selectedPostId);
  useEffect(() => {
    selectedPostIdRef.current = selectedPostId;
  }, [selectedPostId]);

  // ===== Zoom-aware helpers 

  // grid size in degrees for bucketing density at a given zoom
  const gridSizeForZoom = (z) => {
    if (z <= 4)  return 0.65;
    if (z <= 5)  return 0.33;
    if (z <= 6)  return 0.17;
    if (z <= 7)  return 0.10;
    if (z <= 8)  return 0.07;
    if (z <= 9)  return 0.045;
    if (z <= 10) return 0.027;
    if (z <= 11) return 0.018;
    if (z <= 12) return 0.011;
    return 0.007;
  };

const SEVERITY_CELL_DEG = 0.35; // ~30–40km

const severityGridSizeForZoom = () => SEVERITY_CELL_DEG;

  // DEN​SITY heat kernel config
  const densityHeatConfigForZoom = (z) => {
    const zz = Math.max(4, Math.min(12, z));
    const t = (zz - 4) / 8; // 0 at z=4, 1 at z=12
    const radius = Math.round(DENSITY.RADIUS_Z4 + (DENSITY.RADIUS_Z12 - DENSITY.RADIUS_Z4) * t);
    const blur = Math.round(radius * DENSITY.BLUR_FACTOR);
    const minOpacity = +(
      DENSITY.MINOPACITY_Z4 + (DENSITY.MINOPACITY_Z12 - DENSITY.MINOPACITY_Z4) * t
    ).toFixed(2);
    return { radius, blur, minOpacity };
  };

  // SEVERITY CIRCLE CONFIG
  const getSeverityRadiusKm = (severityWeight) => {
    if (severityWeight >= 0.8) return 60;      // severe → 60km radius (BIG!)
    if (severityWeight >= 0.5) return 40;      // moderate → 40km radius
    return 25;                                  // low → 25km radius
  };

  const getSeverityColor = (severityWeight) => {
    if (severityWeight >= 0.8) return '#dc2626';      // severe → red
    if (severityWeight >= 0.5) return '#f97316';      // moderate → orange
    return '#22c55e';                                  // low → green
  };

  // Get severity border color for markers
  const getSeverityBorderColor = (post) => {
    if (!showSeverityRef.current) 
      return null; // No border if severity not visible
    
    const sev = readSeverity(post);
    if (!sev) return null;

    let w;
    if (sev.kind === 'score') {
      const v = Number(sev.value);
      if (v <= 1)       w = clamp01(v);
      else if (v <= 10) w = clamp01(v / 10);
      else              w = clamp01(v / (v + 1));
    } else {
      w = (sev.value === 'severe')   ? 1.0
        : (sev.value === 'moderate') ? 0.6
        : 0.25;
    }

    return getSeverityColor(w);
  };

  // circle marker size by zoom 
  const markerRadiusForZoom = (z) => {
    if (z < 3)  return 3.5;
    if (z < 4)  return 6;
    if (z < 5)  return 8;
    if (z < 6)  return 10;
    if (z < 7)  return 12;
    if (z < 8)  return 14;
    if (z < 10) return 16;
    return 18;
  };

  // marker styles
  const styleFor = (post, type, radius) => {
    const severityBorder = getSeverityBorderColor(post);
  return {
    radius,
    
    weight: severityBorder ? 2 : 1.2,   
    opacity: 0.7,                        
    fillOpacity: 0.85,                 
    color: severityBorder || '#ffffff',  
    fillColor: colorForType(type),
  };
  };
  
  const selectedStyleFor = (post, type, radius) => {
    const severityBorder = getSeverityBorderColor(post);
  return {
    radius: radius + 2,
    weight: 3,                        
    opacity: 0.9,                       
    fillOpacity: 0.95,                   
    color: severityBorder || '#ffffff',
    fillColor: colorForType(type),
  };
  };

  const groupKeyFor = (lat, lng) => `${lat.toFixed(5)}|${lng.toFixed(5)}`;

  const bringLayerToBack  = (layer) => { if (layer?.bringToBack)  layer.bringToBack();  };
  const bringLayerToFront = (layer) => { if (layer?.bringToFront) layer.bringToFront(); };

  // jump to previous/next post that shares this location
const openPostInGroup = (currentPostId, direction) => {
  const map = mapRef.current;
  if (!map) return;

  // always use string keys for the index
  const idKey = String(currentPostId);
  const idxInfo = markerGroupIndexRef.current.get(idKey);

  // helpful debug see this when you click arrows
  console.log('openPostInGroup called:', { idKey, idxInfo });

  if (!idxInfo) return;

  const { groupKey, index, size } = idxInfo;
  const group = markerGroupsRef.current.get(groupKey);
  if (!group || !group.posts || group.posts.length === 0) return;

  const total = size || group.posts.length;
  if (total <= 1) return;

  let nextIndex = index + direction;
  if (nextIndex < 0) nextIndex = total - 1;
  if (nextIndex >= total) nextIndex = 0;

  const nextPost = group.posts[nextIndex];
  if (!nextPost) return;

  const mk = markerByIdRef.current.get(nextPost.id);
  if (!mk) return;

  // update selection (PostList + marker styling)
  onSelectPost?.(nextPost.id);

  // bring marker to front
  if (mk.bringToFront) mk.bringToFront();
  if (markersLayerRef.current) bringLayerToFront(markersLayerRef.current);

  // open popup for the new post
  mk.openPopup();

  // update the popup nav label and current id
  const popup = map._popup;
  if (!popup) return;
  const el = popup.getElement();
  if (!el) return;

  const nav = el.querySelector('.popup-nav');
  if (!nav) return;

  nav.setAttribute('data-post-id', String(nextPost.id));
  const label = nav.querySelector('.popup-nav-label');
  if (label) {
    label.textContent = `${nextIndex + 1} / ${total}`;
  }
};

// Density heatmap = bucket posts into grid cells, convert to posts/km², normalize.
  const buildDensityHeatData = (z) => {
    const cell = gridSizeForZoom(z);
    const roundTo = (v) => Math.round(v / cell) * cell;

    const buckets = new Map(); // "lat|lng" -> { lat, lng, count }
    for (const p of postsRef.current) {
      const lat = p.lat ?? p.latitude;
      const lng = p.lng ?? p.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const latR = +roundTo(lat).toFixed(6);
      const lngR = +roundTo(lng).toFixed(6);
      const key = `${latR}|${lngR}`;
      const prev = buckets.get(key);
      if (prev) prev.count += 1;
      else buckets.set(key, { lat: latR, lng: lngR, count: 1 });
    }

    const toDensity = ({ lat, lng, count }) => {
      const latKm = KM_PER_DEG * cell;
      const lonKm = KM_PER_DEG * Math.cos((lat * Math.PI) / 180) * cell;
      const areaKm2 = Math.max(1e-6, latKm * lonKm);
      return { lat, lng, d: count / areaKm2 };
    };

    const dens = Array.from(buckets.values()).map(toDensity);

    // min/median/max for legend; normalize for heat weights
    const maxD = dens.reduce((m, x) => Math.max(m, x.d), 0) || 1;
    const minD = dens.reduce((m, x) => Math.min(m, x.d), maxD) || 0;
    const sorted = dens.map(x => x.d).sort((a, b) => a - b);
    const mid = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;

    const pts = dens.map(({ lat, lng, d }) => [lat, lng, clamp01(d / maxD)]);

    return { pts, stats: { min: minD, q50: mid, max: maxD } };
  };

  // Severity circles = one circle per post with severity
  const buildSeverityCircles = () => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing severity layers
    if (severityLayerRef.current) {
      severityLayerRef.current.clearLayers();
    } else {
      severityLayerRef.current = L.layerGroup({ pane: 'severity' });
    }
    
    if (severitySelectedLayerRef.current) {
      severitySelectedLayerRef.current.clearLayers();
    } else {
      severitySelectedLayerRef.current = L.layerGroup({ pane: 'severitySelected' });
    }
    
    // Clear the circle tracking map
    severityCircleByIdRef.current.clear();
    
    // Get the current selected post ID
    const currentSelectedId = selectedPostIdRef.current;

    for (const p of postsRef.current) {
      const lat = p.lat ?? p.latitude;
      const lng = p.lng ?? p.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const sev = readSeverity(p);
      if (!sev) continue;

      // map severity = 0..1 weight
      let w;
      if (sev.kind === 'score') {
        const v = Number(sev.value);
        if (v <= 1)       w = clamp01(v);
        else if (v <= 10) w = clamp01(v / 10);
        else              w = clamp01(v / (v + 1));
      } else {
        w = (sev.value === 'severe')   ? 1.0
          : (sev.value === 'moderate') ? 0.6
          : 0.25;
      }

      if (w <= 0.01) continue;

      // Create circle with  geographic radius
      const radiusKm = getSeverityRadiusKm(w);
      const radiusMeters = radiusKm * 1000;
      const color = getSeverityColor(w);
      
      // Check if this post is currently selected
      const isSelected = p.id === currentSelectedId;

      const circle = L.circle([lat, lng], {
        radius: radiusMeters,
        fillColor: color,
        fillOpacity: isSelected ? 0.35 : 0.2,  // Glow when selected
        color: color,       
        weight: isSelected ? 2.5 : 1.2,        
        opacity: isSelected ? 0.8 : 0.5,     
        pane: isSelected ? 'severitySelected' : 'severity',  
        interactive: false,
        className: 'severity-circle'          
      });

      // Add to correct layer based on selection
      circle.addTo(isSelected ? severitySelectedLayerRef.current : severityLayerRef.current);
      
      // Store reference to this circle by post ID
      severityCircleByIdRef.current.set(p.id, { 
        circle, 
        color, 
        radiusMeters, 
        weight: w,
        postId: p.id,
        lat,
        lng
      });
    }
  };
  
  // ===== Legend HTML 
  const getDensityLegendHTML = () => {
    const { min, q50, max } = heatStatsRef.current || { min: 0, q50: 0, max: 0 };
    const fmt = (x) => (x >= 100 ? Math.round(x) : (x >= 10 ? x.toFixed(1) : x.toFixed(2)));
    return `
      <section class="legend-section legend-density">
        <div class="legend-title">Post density (posts/km²)</div>
        <div class="legend-gradient">
          <span class="grad-stop">Low</span>
          <div class="grad-bar"></div>
          <span class="grad-stop">High</span>
        </div>
        <div class="legend-ticks">
          <span>${fmt(min)}</span>
          <span>${fmt(q50)}</span>
          <span>${fmt(max)}</span>
        </div>
      </section>
    `;
  };

  const getSeverityLegendHTML = () => {
    return `
      <section class="legend-section legend-severity">
        <div class="legend-title">Severity</div>
        <div class="legend-gradient legend-gradient--severity">
          <span class="grad-stop">Low</span>
          <div class="grad-bar"></div>
          <span class="grad-stop">Severe</span>
        </div>
        <div class="legend-ticks">
          <span>Low</span><span>Moderate</span><span>Severe</span>
        </div>
      </section>
    `;
  };

  const getTypeLegendHTML = () => {
    const uniqueTypes = Array.from(
      new Set((postsRef.current || [])
        .map(p => String(p.disasterType || '').trim())
        .filter(Boolean))
    ).sort();

    const rows = uniqueTypes.length
      ? uniqueTypes.map(t => {
          const color = colorForType(t);
          return `
            <div class="legend-row">
              <span class="legend-swatch" style="background:${color}"></span>
              <span>${t}</span>
            </div>
          `;
        }).join('')
      : '<div class="legend-row"><span>No types</span></div>';

    return `
      <section class="legend-section legend-types">
        <div class="legend-title">Hazard Types</div>
        ${rows}
      </section>
    `;
  };

  const updateLegendForMode = () => {
    if (!legendVisibleRef.current || !legendElRef.current) return;
    
    const sections = [];
    
    if (showDensityRef.current) sections.push(getDensityLegendHTML());
    if (showSeverityRef.current) sections.push(getSeverityLegendHTML());
    if (showMarkersRef.current) sections.push(getTypeLegendHTML());
    
    if (sections.length > 1) {
      legendElRef.current.innerHTML = `
        <div class="legend-combined">
          ${sections.join('')}
        </div>
      `;
    } else if (sections.length === 1) {
      legendElRef.current.innerHTML = sections[0];
    } else {
      legendElRef.current.innerHTML = '<div class="legend-section"><div class="legend-title">No layers visible</div></div>';
    }
  };

  // ===== Update density heatmap
  const updateDensity = () => {
    const map = mapRef.current;
    if (!map) return;

    const z = map.getZoom();
    const { pts, stats } = buildDensityHeatData(z);
    heatStatsRef.current = stats;

    const conf = densityHeatConfigForZoom(z);

    const layerOpts = {
      radius: conf.radius,
      blur: conf.blur,
      minOpacity: conf.minOpacity,
      pane: 'density',  // Use density pane (z-index 200)
      gradient: { 
        0.00: '#e6fffb', 
        0.35: '#99f6e4', 
        0.70: '#2dd4bf', 
        1.00: '#0f766e' 
      }
    };

    const same =
      heatConfRef.current.radius === conf.radius &&
      heatConfRef.current.blur === conf.blur &&
      heatConfRef.current.minOpacity === conf.minOpacity;

    if (!heatRef.current || !same) {
      if (heatRef.current) heatRef.current.remove();
      heatRef.current = L.heatLayer(pts, layerOpts);
    } else {
      if (typeof heatRef.current.setOptions === 'function') {
        heatRef.current.setOptions(layerOpts);
      }
      heatRef.current.setLatLngs(pts);
    }

    heatConfRef.current = conf;

    // Add to map if should be visible
    if (showDensityRef.current && heatRef.current && !map.hasLayer(heatRef.current)) {
      heatRef.current.addTo(map);
    } else if (!showDensityRef.current && heatRef.current && map.hasLayer(heatRef.current)) {
      map.removeLayer(heatRef.current);
    }
  };

  // ===== Update severity circles
  const updateSeverity = () => {
    const map = mapRef.current;
    if (!map) return;

    buildSeverityCircles();

    // Add/remove normal severity layer
    if (showSeverityRef.current && severityLayerRef.current && !map.hasLayer(severityLayerRef.current)) {
      severityLayerRef.current.addTo(map);
    } else if (!showSeverityRef.current && severityLayerRef.current && map.hasLayer(severityLayerRef.current)) {
      map.removeLayer(severityLayerRef.current);
    }
    
    // Add/remove selected severity layer
    if (showSeverityRef.current && severitySelectedLayerRef.current && !map.hasLayer(severitySelectedLayerRef.current)) {
      severitySelectedLayerRef.current.addTo(map);
    } else if (!showSeverityRef.current && severitySelectedLayerRef.current && map.hasLayer(severitySelectedLayerRef.current)) {
      map.removeLayer(severitySelectedLayerRef.current);
    }
    
  };

  // ===== Update all layers
  const updateAllLayers = () => {
    updateDensity();
    updateSeverity();
    updateLegendForMode();
  };
  
  // ===== Markers 
const rebuildMarkers = () => {
  if (!mapRef.current) return;

  // build groups of posts that share same location
  const groups = new Map();
  const groupIndex = new Map();

  for (const p of postsRef.current) {
    const lat = p.lat ?? p.latitude;
    const lng = p.lng ?? p.longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (p.id == null) continue;

    const key = groupKeyFor(lat, lng);
    let g = groups.get(key);
    if (!g) {
      g = { key, lat, lng, posts: [] };
      groups.set(key, g);
    }
    g.posts.push(p);
  }

  // Fill index lookup: postId -> { groupKey, index, size }
  groups.forEach((g) => {
    g.posts.forEach((p, idx) => {
      const idKey = String(p.id);
      groupIndex.set(idKey, {
        groupKey: g.key,
        index: idx,
        size: g.posts.length,
      });
    });
  });

  markerGroupsRef.current = groups;
  markerGroupIndexRef.current = groupIndex;

  if (!markersLayerRef.current) {
    markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
  } else {
    markersLayerRef.current.clearLayers();
  }
  markerByIdRef.current.clear();

  const z = mapRef.current.getZoom();
  const r = markerRadiusForZoom(z);

  postsRef.current.forEach((p) => {
    const lat = p.lat ?? p.latitude;
    const lng = p.lng ?? p.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    if (p.id == null) return;

    const sevHas = hasSeverity(p);
    const sevLabel = sevHas ? String(p.severityLevel).trim() : '—';

    const idKey = String(p.id);
    const idxInfo = markerGroupIndexRef.current.get(idKey);
    const idx = idxInfo?.index ?? 0;
    const size = idxInfo?.size ?? 1;
    const hasGroupNav = size > 1;

    const popupHtml = `
      <div style="max-width:260px;line-height:1.25">
        <div style="font-weight:600;margin-bottom:4px">@${(p.username || 'unknown')}</div>
        <div style="margin-bottom:6px">${(p.text || '').replace(/</g,'&lt;')}</div>
        <div style="font-size:12px;opacity:.8">
          ${(p.disasterType ? `Type: ${p.disasterType}` : 'Type: Other')}
          · Severity: ${sevLabel}
          <br/>
          ${p.createdAt ? new Date(p.createdAt).toLocaleString() : ''}
        </div>
        ${hasGroupNav
            ? `
              <div class="popup-nav" data-post-id="${idKey}">
                <button type="button" class="popup-nav-btn" data-dir="-1" aria-label="Previous nearby report">‹ Prev</button>
                <span class="popup-nav-label">${idx + 1} / ${size}</span>
                <button type="button" class="popup-nav-btn" data-dir="1" aria-label="Next nearby report">Next ›</button>
              </div>
              `
            : ''
          }
      </div>
    `;

    const mk = L.circleMarker([lat, lng], {
        ...styleFor(p, p.disasterType, r),
        pane: 'markers',
        renderer: markersRendererRef.current,
    })
      // Attach the popup
    .bindPopup(popupHtml, { autoPan: false, className: 'post-popup' })
      .on('click', (e) => {
        if (e.originalEvent) {
          L.DomEvent.stop(e.originalEvent);
        }
        // just update selection
        onSelectPost?.(p.id);
      });

    // stash the id on the marker so popup nav can use it
    mk.postId = p.id;

    mk.addTo(markersLayerRef.current);
    markerByIdRef.current.set(p.id, mk);
  });

  // highlight selected
  if (selectedPostId != null) {
    const sel = markerByIdRef.current.get(selectedPostId);
    const p = postsRef.current.find((pp) => pp.id === selectedPostId);
    if (sel && p) sel.setStyle(selectedStyleFor(p, p.disasterType, r));
  }

  bringLayerToFront(markersLayerRef.current);
};

  // ===== Legend controls & Mode/Metric controls
  const legendControlRef = useRef(null);
  const legendElRef = useRef(null);
  const legendToggleControlRef = useRef(null);
  const legendVisibleRef = useRef(false);

  const setLegendVisible = (want) => {
    legendVisibleRef.current = !!want;
    const ctrl = legendControlRef.current;
    if (!ctrl || !ctrl._container) return;
    ctrl._container.style.display = want ? 'block' : 'none';

    const tgl = legendToggleControlRef.current;
    if (tgl && tgl._container) {
      const btn = tgl._container.querySelector('button.legend-toggle');
      if (btn) {
        btn.classList.toggle('active', !!want);
        btn.textContent = want ? '▲ Hide Legend' : '▼ View Legend';
        btn.setAttribute('aria-pressed', want ? 'true' : 'false');
        btn.setAttribute('title', want ? 'Hide legend' : 'Show legend');
      }
    }
    if (want) updateLegendForMode();
  };

  // ===== Map init
  useEffect(() => {
    if (mapRef.current || !mapEl.current) return;

    const map = L.map(mapEl.current, {
      center: INITIAL_VIEW.center,
      zoom: INITIAL_VIEW.zoom,
      minZoom: 2,
      preferCanvas: true,
      zoomControl: false,
      maxBounds: WORLD_BOUNDS,
      maxBoundsViscosity: 1.0,
      worldCopyJump: false,
      inertia: false,
      zoomAnimation: true,
      fadeAnimation: true,
      markerZoomAnimation: true
    });
    mapRef.current = map;

    const resizeOnce = () => map.invalidateSize(false);
    if (document.readyState === 'complete') setTimeout(resizeOnce, 0);
    else window.addEventListener('load', resizeOnce, { once: true });
    const ro = new ResizeObserver(() => map.invalidateSize(false));
    ro.observe(mapEl.current);

    // base tiles
    L.tileLayer(
      'https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.{ext}',
      {
        minZoom: 0,
        maxZoom: 20,
        ext: 'png',
        noWrap: false,
        bounds: WORLD_BOUNDS,
        keepBuffer: 3,
        attribution:
          '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> ' +
          '&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> ' +
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      }
    ).addTo(map);

    // panes with z-index stacking
    map.createPane('density');          // bottom layer
    map.createPane('severity');         // normal severity circles
    map.createPane('severitySelected'); // selected severity circle (above normal)
    map.createPane('markers');          // top layer
    
    const densityPane = map.getPane('density');   
    if (densityPane)  densityPane.style.zIndex = 200;
    
    const severityPane = map.getPane('severity'); 
    if (severityPane) severityPane.style.zIndex = 300;
    
    const severitySelectedPane = map.getPane('severitySelected');
    if (severitySelectedPane) severitySelectedPane.style.zIndex = 400; // Above normal severity
    
    const markPane = map.getPane('markers');      
    if (markPane)     markPane.style.zIndex = 600;

    // renderer for markers
    markersRendererRef.current = L.canvas({ padding: 0.5, pane: 'markers' });

    // zoom control
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Reset View control
    const resetControl = L.control({ position: 'bottomleft' });
    resetControl.onAdd = function () {
      const c = L.DomUtil.create('div', 'leaflet-control');
      c.innerHTML = `
        <button type="button" class="map-reset-btn" title="Reset map view" aria-label="Reset map view">
          <img src="${resetIconUrl}" alt="">
        </button>
      `;
      const btn = c.querySelector('button');
      L.DomEvent.disableClickPropagation(c);
      L.DomEvent.on(btn, 'click', (e) => {
        L.DomEvent.stopPropagation(e);
        map.setView(INITIAL_VIEW.center, INITIAL_VIEW.zoom, { animate: true });
      });
      return c;
    };
    resetControl.addTo(map);

    // click clears selection
    map.on('click', () => {
      onSelectPost?.(null);
      map.closePopup();
    });

    // Legend (bottom-right)
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function () {
      const wrapper = L.DomUtil.create('div', 'map-legend');
      wrapper.style.display = 'none';
      const inner = L.DomUtil.create('div', 'map-legend-inner', wrapper);
      legendElRef.current = inner;
      L.DomEvent.disableClickPropagation(wrapper);
      return wrapper;
    };
    legend.addTo(map);
    legendControlRef.current = legend;

    // Legend toggle chip
    const legendToggle = L.control({ position: 'bottomright' });
    legendToggle.onAdd = function () {
      const c = L.DomUtil.create('div', 'leaflet-control');
      c.innerHTML = `
        <button type="button" class="chip legend-toggle" aria-pressed="false" title="Show legend">
          ▼ View Legend
        </button>
      `;
      const btn = c.querySelector('button.legend-toggle');
      L.DomEvent.disableClickPropagation(c);
      L.DomEvent.on(btn, 'click', (e) => {
        L.DomEvent.stopPropagation(e);
        setLegendVisible(!legendVisibleRef.current);
      });
      return c;
    };
    legendToggle.addTo(map);
    legendToggleControlRef.current = legendToggle;

    // Layer toggles
    const togglesEl = L.DomUtil.create('div', 'map-modes map-modes--center', map.getContainer());
    togglesEl.innerHTML = `
      <div role="group" aria-label="Map layers" class="map-modes-inner">
        <button class="chip mode-btn mode-btn--square active" data-layer="markers">
          Markers
        </button>
        <button class="chip mode-btn mode-btn--square active" data-layer="density">
          Density
        </button>
        <button class="chip mode-btn mode-btn--square active" data-layer="severity">
          Severity
        </button>
      </div>
    `;
    L.DomEvent.disableClickPropagation(togglesEl);
    L.DomEvent.on(togglesEl, 'mousewheel', L.DomEvent.stopPropagation);
    
    togglesEl.querySelectorAll('.mode-btn').forEach(btn => {
      L.DomEvent.on(btn, 'click', (e) => {
        L.DomEvent.stopPropagation(e);
        const layer = btn.getAttribute('data-layer');
        
        if (layer === 'markers') {
          showMarkersRef.current = !showMarkersRef.current;
          btn.classList.toggle('active', showMarkersRef.current);
          
          if (showMarkersRef.current && markersLayerRef.current && !map.hasLayer(markersLayerRef.current)) {
            markersLayerRef.current.addTo(map);
          } else if (!showMarkersRef.current && markersLayerRef.current && map.hasLayer(markersLayerRef.current)) {
            map.removeLayer(markersLayerRef.current);
          }
          
        } else if (layer === 'density') {
          showDensityRef.current = !showDensityRef.current;
          btn.classList.toggle('active', showDensityRef.current);
          updateDensity();
          
        } else if (layer === 'severity') {
          showSeverityRef.current = !showSeverityRef.current;
          btn.classList.toggle('active', showSeverityRef.current);
          updateSeverity();
          rebuildMarkers();
          if (showSeverityRef.current) {
            // turning severity ON 
            showSeverityHint();
          } else {
            // turning severity OFF 
            clearSeverityHint();
          }
        }
        
        updateLegendForMode();
      });
    });

    // When any popup opens, wire up 
    map.on('popupopen', (e) => {
      const container = e.popup.getElement();
      if (!container) return;

      const nav = container.querySelector('.popup-nav');
      if (!nav) return;

      const marker = e.popup._source;
      const baseId =
        (marker && marker.postId != null ? String(marker.postId) : null) ||
        nav.getAttribute('data-post-id');

      if (!baseId) {
        console.warn('[MapView] popupopen: No baseId found', { marker, nav });
        return;
      }

      // Verify this post exists in our grouping index
      const idxInfo = markerGroupIndexRef.current.get(String(baseId));
      if (!idxInfo) {
        console.warn('[MapView] popupopen: Post not in groupIndex', { baseId });
        return;
      }

      const buttons = nav.querySelectorAll('.popup-nav-btn');

      buttons.forEach((btn) => {
        const dir = Number(btn.getAttribute('data-dir') || '0');

        // Remove any existing listeners to prevent duplicates
        L.DomEvent.off(btn, 'click');
        
        L.DomEvent.on(btn, 'click', (ev) => {
          L.DomEvent.stop(ev);
          // Always start from the correct base id for this popup
          console.log('[MapView] Nav button clicked:', { baseId, dir });
          openPostInGroup(baseId, dir);
        });
      });
    });

    // Initial draws
    updateAllLayers();
    rebuildMarkers();

    // If severity is initially visible, show hint once on load
    if (showSeverityRef.current) {
      showSeverityHint();
    }

    // Update on zoom/move
    map.on('zoomend moveend', () => {
      updateAllLayers();
      // restyle markers w/ zoom radius
      const z = map.getZoom();
      const r = markerRadiusForZoom(z);
      const currentSelectedId = selectedPostIdRef.current; 

      markerByIdRef.current.forEach((mk, id) => {
        const p = postsRef.current.find(pp => pp.id === id);
        if (!p) return;
        const sel = (id === currentSelectedId);
        mk.setStyle(
          sel
            ? selectedStyleFor(p, p.disasterType, r)
            : styleFor(p, p.disasterType, r)
        );
      });
    });
  }, []);

  // Rebuild on posts change
  useEffect(() => {
    if (!mapRef.current) return;
    updateAllLayers();
    rebuildMarkers();
  }, [posts]);

  // Restyle selection on change
  useEffect(() => {
    if (!mapRef.current) return;
    const z = mapRef.current.getZoom();
    const r = markerRadiusForZoom(z);
    
    // Update marker styles
    markerByIdRef.current.forEach((mk, id) => {
      const p = postsRef.current.find(pp => pp.id === id);
      if (!p) return;
      mk.setStyle(
        id === selectedPostId 
        ? selectedStyleFor(p, p.disasterType, r) 
        : styleFor(p, p.disasterType, r)
      );
    });
    
    // Update severity circle styles
    if (severityCircleByIdRef.current.size > 0) {
      severityCircleByIdRef.current.forEach((circleData, id) => {
        const { circle } = circleData;
        if (!circle || !circle.setStyle) return; // Safety check
        
        const isSelected = id === selectedPostId;
        
        try {
          // Remove from current layer first
          if (severityLayerRef.current && severityLayerRef.current.hasLayer(circle)) {
            severityLayerRef.current.removeLayer(circle);
          }
          if (severitySelectedLayerRef.current && severitySelectedLayerRef.current.hasLayer(circle)) {
            severitySelectedLayerRef.current.removeLayer(circle);
          }
          
          // Update styles
          circle.setStyle({
            fillOpacity: isSelected ? 0.35 : 0.2,  
            weight: isSelected ? 2.5 : 1.2,        
            opacity: isSelected ? 0.8 : 0.5,      
          });
          
          // Add to appropriate layer 
          if (isSelected) {
            circle.addTo(severitySelectedLayerRef.current);
          } else {
            circle.addTo(severityLayerRef.current);
          }
          
        } catch (err) {
          console.warn('[MapView] Error updating severity circle style:', err);
        }
      });
    }
  }, [selectedPostId]);

  // Zoom to selected & open popup
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // No selection 
    if (selectedPostId == null) {
      map.closePopup();
      return;
    }

    const p = (postsRef.current || []).find((pp) => pp.id === selectedPostId);
    if (!p) return;

    const lat = p.lat ?? p.latitude;
    const lng = p.lng ?? p.longitude;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      onMissingCoords?.(p);
      return;
    }

    onHasCoords?.();

    const mk = markerByIdRef.current.get(selectedPostId);
    if (!mk) return;

    const alreadyOpen = mk.isPopupOpen && mk.isPopupOpen();
    const targetZoom = Math.max(map.getZoom(), SELECTION_ZOOM);
    const targetLatLng = L.latLng(lat, lng);

    if (!alreadyOpen) {
      map.once('moveend', () => {
        // Make sure the same post is  selected and the marker  exists
        if (
          markerByIdRef.current.has(selectedPostId) &&
          mk &&
          mk.openPopup
        ) {
          mk.openPopup();
        }
      });

      map.flyTo(targetLatLng, targetZoom, {
        animate: true,
        duration: 0.6,
      });
    } else {
      map.flyTo(targetLatLng, targetZoom, {
        animate: true,
        duration: 0.6,
      });
    }
  }, [selectedPostId]);

  return <div ref={mapEl} className="map" role="application" aria-label="Disaster map" />;
}
