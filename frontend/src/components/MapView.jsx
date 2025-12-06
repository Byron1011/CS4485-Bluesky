import { useEffect, useRef } from 'react';
import { getTypeColor } from '../theme/typeColors';
import { useNotifications } from '../NotificationContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import resetIconUrl from '../assets/resetZoom.png';

const SELECTION_ZOOM = 9;const KM_PER_DEG = 111.32;

const DENSITY = {
  RADIUS_Z4: 14,   
  RADIUS_Z12: 6,   
  BLUR_FACTOR: 0.22,  
  MINOPACITY_Z4: 0.5, 
  MINOPACITY_Z12: 0.5 
};

const WORLD_BOUNDS = L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180));
const INITIAL_VIEW = { center: [35, -35], zoom: 3 };

// helpers
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// detectors/parsers
const readSeverity = (p) => {
  const lvlRaw = (p?.severityLevel ?? p?.severity ?? p?.severity_label ?? '')
    .toString().trim().toLowerCase();
  const scoreRaw = (p?.severityScore ?? p?.severity_score ?? p?.severityValue ?? p?.severity_value ?? null);

  const missingTokens = ['none', 'unknown', 'no severity', 'no-severity', 'n/a', 'na', 'null'];

  if (lvlRaw && missingTokens.includes(lvlRaw)) {
    return null;
  }

  if (!lvlRaw && scoreRaw === null) {
    return null;
  }

  if (scoreRaw !== null) {
    const num = Number(scoreRaw);
    if (Number.isFinite(num) && num > 0) return { kind: 'score', value: num };
  }

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

  if (lvlRaw && /^[0-9.]+$/.test(lvlRaw)) {
    const num = Number(lvlRaw);
    if (Number.isFinite(num) && num > 0) return { kind: 'score', value: num };
  }
  return null;
};

// Get severity level string for a post
const getSeverityLevel = (p) => {
  const sev = readSeverity(p);
  if (!sev) return 'unknown';
  
  if (sev.kind === 'label') return sev.value;
  
  // Convert score to level
  const score = Number(sev.value);
  if (score >= 0.66) return 'severe';
  if (score >= 0.33) return 'moderate';
  return 'low';
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
  const moveDebounceRef = useRef(null);

  const allModesHintIdRef = useRef(null);

const showAllModesHint = () => {
  if (allModesHintIdRef.current != null) {
    remove(allModesHintIdRef.current);
    allModesHintIdRef.current = null;
  }

  if (showMarkersRef.current && showDensityRef.current && showSeverityRef.current) {
    const id = notify({
      type: 'info',
      text: 'Zoom in or out to see more information',
      duration: 5000,
    });
    allModesHintIdRef.current = id;
  }
};

const clearAllModesHint = () => {
  if (allModesHintIdRef.current != null) {
    remove(allModesHintIdRef.current);
    allModesHintIdRef.current = null;
  }
};

  // latest posts
  const postsRef = useRef(posts);
  useEffect(() => { postsRef.current = posts; }, [posts]);

  // type color
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

  const heatRef = useRef(null);
  
  // Severity marker layer (divIcon)
  const severityMarkersLayerRef = useRef(null);
  const severityMarkerByIdRef = useRef(new Map());
  
  const heatConfRef = useRef({ radius: 0, blur: 0, minOpacity: 0.0 });
  const heatStatsRef = useRef({ min: 0, q50: 0, max: 0 });

  // mode state 
  const showMarkersRef = useRef(true);
  const showDensityRef = useRef(true);
  const showSeverityRef = useRef(true);

  const selectedPostIdRef = useRef(selectedPostId);
  useEffect(() => {
    selectedPostIdRef.current = selectedPostId;
  }, [selectedPostId]);

  // grid size for density bucketing
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

  // Density heat kernel config
  const densityHeatConfigForZoom = (z) => {
    const zz = Math.max(4, Math.min(12, z));
    const t = (zz - 4) / 8;
    const radius = Math.round(DENSITY.RADIUS_Z4 + (DENSITY.RADIUS_Z12 - DENSITY.RADIUS_Z4) * t);
    const blur = Math.round(radius * DENSITY.BLUR_FACTOR);
    const minOpacity = +(
      DENSITY.MINOPACITY_Z4 + (DENSITY.MINOPACITY_Z12 - DENSITY.MINOPACITY_Z4) * t
    ).toFixed(2);
    return { radius, blur, minOpacity };
  };

  // circle marker size by zoom 
  const markerRadiusForZoom = (z) => {
    if (z < 3)  return 3.5;
    if (z < 4)  return 6;
    if (z < 5)  return 8;
    if (z < 6)  return 10;
    if (z < 7)  return 12;
    if (z < 8)  return 14;
    if (z < 10) return 15;
    return 16;
  };

  // Severity marker sizing
  const severitySizeForZoom = (level, zoom) => {
  // Base size by severity
  const baseSizes = {
    severe: 24,
    moderate: 20,
    low: 16,
    unknown: 13,
  };

  const base = baseSizes[level] || baseSizes.unknown;

  let scale;
  if (zoom <= 2) {
    // World view 
    scale = level === 'severe' ? 0.5 : 0.4;
  } else if (zoom <= 3) {
    scale = level === 'severe' ? 0.6 : 0.5;
  } else if (zoom <= 5) {
    // Continent view 
    scale = 0.75;
  } else if (zoom <= 7) {
    // Country/region view
    scale = 1.0;
  } else if (zoom <= 9) {
    // State/metro view
    scale = 1.3;
  } else {
    // City/street level
    scale = 1.6;
  }

  return Math.round(base * scale);
};

  // Pulse ring sizes
  const getPulseRingSizeForZoom = (level, zoom) => {
  const baseSizes = {
    severe: 42,
    moderate: 36,
    low: 32,
    unknown: 26,
  };

  const base = baseSizes[level] || baseSizes.unknown;

  let scale;
  if (zoom <= 2) {
    scale = level === 'severe' ? 0.5 : 0.4;
  } else if (zoom <= 3) {
    scale = level === 'severe' ? 0.6 : 0.5;
  } else if (zoom <= 5) {
    scale = 0.75;
  } else if (zoom <= 7) {
    scale = 1.0;
  } else if (zoom <= 9) {
    scale = 1.3;
  } else {
    scale = 1.6;
  }

  return Math.round(base * scale);
};

  // Glow opacity
  const getGlowOpacity = (level, isSelected, isMuted) => {
  if (isMuted) return 0.2;
  if (isSelected) return 1.0;
  
  const opacities = {
    severe: 0.75,
    moderate: 0.72,
    low: 0.69,
    unknown: 0.55
  };
  return opacities[level] || 0.4;
};

  // marker styles (circle markers for type)
  const styleFor = (post, type, radius) => {
    return {
      radius,
      weight: 1.2,   
      opacity: 0.7,                        
      fillOpacity: 0.85,                 
      color: '#ffffff',  
      fillColor: colorForType(type),
    };
  };
  
  const selectedStyleFor = (post, type, radius) => {
    return {
      radius: radius + 2,
      weight: 3,                        
      opacity: 0.9,                       
      fillOpacity: 0.95,                   
      color: '#ffffff',
      fillColor: colorForType(type),
    };
  };

  const groupKeyFor = (lat, lng) => `${lat.toFixed(5)}|${lng.toFixed(5)}`;

  const bringLayerToBack  = (layer) => { if (layer?.bringToBack)  layer.bringToBack();  };
  const bringLayerToFront = (layer) => { if (layer?.bringToFront) layer.bringToFront(); };

  // Navigate between stacked posts
  const openPostInGroup = (currentPostId, direction) => {
    const map = mapRef.current;
    if (!map) return;

    const idKey = String(currentPostId);
    const idxInfo = markerGroupIndexRef.current.get(idKey);

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

    onSelectPost?.(nextPost.id);

    if (mk.bringToFront) mk.bringToFront();
    if (markersLayerRef.current) bringLayerToFront(markersLayerRef.current);

    mk.openPopup();

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

  // Density heatmap
  const buildDensityHeatData = (z) => {
    const cell = gridSizeForZoom(z);
    const roundTo = (v) => Math.round(v / cell) * cell;

    const buckets = new Map();
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

    const maxD = dens.reduce((m, x) => Math.max(m, x.d), 0) || 1;
    const minD = dens.reduce((m, x) => Math.min(m, x.d), maxD) || 0;
    const sorted = dens.map(x => x.d).sort((a, b) => a - b);
    const mid = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;

    const pts = dens.map(({ lat, lng, d }) => [lat, lng, clamp01(d / maxD)]);

    return { pts, stats: { min: minD, q50: mid, max: maxD } };
  };

  // Create severity marker HTML
  const createSeverityMarkerHtml = (severityLevel, isSelected, isMuted, zoom) => {
  const levelClass =
    severityLevel === 'severe'   ? 'sev-severe'   :
    severityLevel === 'moderate' ? 'sev-moderate' :
    severityLevel === 'low'      ? 'sev-low'      :
                                   'sev-unknown';

  const classes = [
    'severity-marker',
    levelClass,
    isSelected ? 'selected' : '',
    isMuted ? 'muted' : '',
  ].filter(Boolean).join(' ');

  const iconSize = severitySizeForZoom(severityLevel, zoom);
  const pulseSize = getPulseRingSizeForZoom(severityLevel, zoom);
  
  const coreSize = Math.max(8, Math.round(iconSize * 0.65));

  const glowSize = Math.round(iconSize * 1.3);
  
  const glowOpacity = getGlowOpacity(severityLevel, isSelected, isMuted);
  
  const pulseSpeed = 
    severityLevel === 'severe' ? '0.9s' :
    severityLevel === 'moderate' ? '1.4s' :
    severityLevel === 'low' ? '2s' : '2.5s';

  const pulseHtml = isSelected
    ? `
      <div class="pulse-ring" style="
        width: ${pulseSize}px; 
        height: ${pulseSize}px;
        animation-duration: ${pulseSpeed};
      "></div>
      <div class="pulse-ring pulse-ring-2" style="
        width: ${pulseSize}px; 
        height: ${pulseSize}px;
        animation-duration: ${pulseSpeed};
        animation-delay: calc(${pulseSpeed} / 3);
      "></div>
      <div class="pulse-ring pulse-ring-3" style="
        width: ${pulseSize}px; 
        height: ${pulseSize}px;
        animation-duration: ${pulseSpeed};
        animation-delay: calc(${pulseSpeed} * 2 / 3);
      "></div>
    `
    : '';

  return `
    <div class="${classes}" style="--pulse-speed: ${pulseSpeed}; --glow-opacity: ${glowOpacity};">
      <div class="static-glow" style="width: ${glowSize}px; height: ${glowSize}px; opacity: ${glowOpacity};"></div>
      <div class="core" style="width: ${coreSize}px; height: ${coreSize}px;"></div>
      ${pulseHtml}
    </div>
  `;
};

  //Build/Update severity markers
  const buildSeverityMarkers = () => {
    const map = mapRef.current;
    if (!map) {
      console.log('[Severity] No map');
      return;
    }

    const zoom = map.getZoom();

    // Clear existing
    if (severityMarkersLayerRef.current) {
      severityMarkersLayerRef.current.clearLayers();
    } else {
      severityMarkersLayerRef.current = L.layerGroup();
    }
    severityMarkerByIdRef.current.clear();

    const currentSelectedId = selectedPostIdRef.current;
    const hasSelection = currentSelectedId != null;
    
    let count = 0;

    for (const p of postsRef.current) {
      const lat = p.lat ?? p.latitude;
      const lng = p.lng ?? p.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const severityLevel = getSeverityLevel(p);
      const isSelected = p.id === currentSelectedId;
      const isMuted = hasSelection && !isSelected;

      const html = createSeverityMarkerHtml(severityLevel, isSelected, isMuted, zoom);
      const iconSize = severitySizeForZoom(severityLevel, zoom);

      const icon = L.divIcon({
        html,
        className: 'severity-marker-container',
        iconSize: [iconSize, iconSize],
        iconAnchor: [iconSize / 2, iconSize / 2],
      });

      const marker = L.marker([lat, lng], {
        icon,
        pane: 'severityMarkers',
        interactive: false,
        zIndexOffset: isSelected ? 1000 : 0,
      });

      marker.addTo(severityMarkersLayerRef.current);
      severityMarkerByIdRef.current.set(p.id, {
        marker,
        severityLevel,
        lat,
        lng,
        postId: p.id,
      });
      count++;
    }
    
    console.log(`[Severity] Built ${count} markers at zoom ${zoom}, iconSize example: ${severitySizeForZoom('severe', zoom)}px`);
  };

  // Update severity marker states (selection changed or zoom changed)
  const updateSeverityMarkerStates = () => {
    const map = mapRef.current;
    if (!map) return;
    
    const currentSelectedId = selectedPostIdRef.current;
    const hasSelection = currentSelectedId != null;
    const zoom = map.getZoom();

    severityMarkerByIdRef.current.forEach((data, postId) => {
      const { marker, severityLevel } = data;
      const isSelected = postId === currentSelectedId;
      const isMuted = hasSelection && !isSelected;

      const html = createSeverityMarkerHtml(severityLevel, isSelected, isMuted, zoom);
      const iconSize = severitySizeForZoom(severityLevel, zoom);

      const newIcon = L.divIcon({
        html,
        className: 'severity-marker-container',
        iconSize: [iconSize, iconSize],
        iconAnchor: [iconSize / 2, iconSize / 2],
      });

      marker.setIcon(newIcon);
      marker.setZIndexOffset(isSelected ? 1000 : 0);
    });
  };
  
  // Legend HTML
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

  //severity legend
  const getSeverityLegendHTML = () => {
    return `
      <section class="legend-section legend-severity">
        <div class="legend-title">Severity Level</div>
        <div class="legend-severity-pulsing">
          <div class="legend-severity-item">
            <div class="legend-severity-marker">
              <div class="severity-marker sev-severe">
                <div class="static-glow"></div>
                <div class="core"></div>
              </div>
            </div>
            <span class="legend-severity-label">Severe</span>
          </div>
          <div class="legend-severity-item">
            <div class="legend-severity-marker">
              <div class="severity-marker sev-moderate">
                <div class="static-glow"></div>
                <div class="core"></div>
              </div>
            </div>
            <span class="legend-severity-label">Moderate</span>
          </div>
          <div class="legend-severity-item">
            <div class="legend-severity-marker">
              <div class="severity-marker sev-low">
                <div class="static-glow"></div>
                <div class="core"></div>
              </div>
            </div>
            <span class="legend-severity-label">Low</span>
          </div>
          <div class="legend-severity-item">
            <div class="legend-severity-marker">
              <div class="severity-marker sev-unknown">
                <div class="static-glow"></div>
                <div class="core"></div>
              </div>
            </div>
            <span class="legend-severity-label">Unknown</span>
          </div>
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

  const legendVisibleRef = useRef(false);
  const legendElRef = useRef(null);
  const legendControlRef = useRef(null);
  const legendToggleControlRef = useRef(null);

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

  //Update density heatmap
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
      pane: 'density',
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

    if (showDensityRef.current && heatRef.current && !map.hasLayer(heatRef.current)) {
      heatRef.current.addTo(map);
    } else if (!showDensityRef.current && heatRef.current && map.hasLayer(heatRef.current)) {
      map.removeLayer(heatRef.current);
    }
  };

  //Update severity layer
  const updateSeverity = () => {
    const map = mapRef.current;
    if (!map) return;

    buildSeverityMarkers();

    if (showSeverityRef.current && severityMarkersLayerRef.current && !map.hasLayer(severityMarkersLayerRef.current)) {
      severityMarkersLayerRef.current.addTo(map);
    } else if (!showSeverityRef.current && severityMarkersLayerRef.current && map.hasLayer(severityMarkersLayerRef.current)) {
      map.removeLayer(severityMarkersLayerRef.current);
    }
  };

  //Update all layers 
  const updateAllLayers = () => {
    updateDensity();
    updateSeverity();
    updateLegendForMode();
  };
  
  // post Markers
  const rebuildMarkers = () => {
    if (!mapRef.current) return;

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

      const sevLevel = getSeverityLevel(p);
      const sevLabel = sevLevel !== 'unknown' ? sevLevel : '—';

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
        .bindPopup(popupHtml, { autoPan: false, className: 'post-popup' })
        .on('click', (e) => {
          if (e.originalEvent) {
            L.DomEvent.stop(e.originalEvent);
          }
          onSelectPost?.(p.id);
        });

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

  // Map init
  useEffect(() => {
    if (mapRef.current || !mapEl.current) return;

    const map = L.map(mapEl.current, {
      center: INITIAL_VIEW.center,
      zoom: INITIAL_VIEW.zoom,
      minZoom: 3,
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
      'https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.{ext}?api_key=' + import.meta.env.VITE_STADIA_API_KEY,
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
    map.createPane('density');
    map.createPane('severityMarkers'); 
    map.createPane('markers');
    
    const densityPane = map.getPane('density');   
    if (densityPane)  densityPane.style.zIndex = 350;
    
    const severityPane = map.getPane('severityMarkers');
    if (severityPane) severityPane.style.zIndex = 450; // Between density and markers
    
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
          
          if (showSeverityRef.current && severityMarkersLayerRef.current && !map.hasLayer(severityMarkersLayerRef.current)) {
            severityMarkersLayerRef.current.addTo(map);
          } else if (!showSeverityRef.current && severityMarkersLayerRef.current && map.hasLayer(severityMarkersLayerRef.current)) {
            map.removeLayer(severityMarkersLayerRef.current);
          }
        }

        if (showMarkersRef.current && showDensityRef.current && showSeverityRef.current) {
          showAllModesHint();
        } else {
          clearAllModesHint();
        }
        
        updateLegendForMode();
      });
    });

    // When any popup opens, wire up nav buttons
    map.on('popupopen', (e) => {
      const container = e.popup.getElement();
      if (!container) return;

      const nav = container.querySelector('.popup-nav');
      if (!nav) return;

      const marker = e.popup._source;
      const baseId =
        (marker && marker.postId != null ? String(marker.postId) : null) ||
        nav.getAttribute('data-post-id');

      if (!baseId) return;

      const idxInfo = markerGroupIndexRef.current.get(String(baseId));
      if (!idxInfo) return;

      const buttons = nav.querySelectorAll('.popup-nav-btn');

      buttons.forEach((btn) => {
        const dir = Number(btn.getAttribute('data-dir') || '0');
        L.DomEvent.off(btn, 'click');
        
        L.DomEvent.on(btn, 'click', (ev) => {
          L.DomEvent.stop(ev);
          openPostInGroup(baseId, dir);
        });
      });
    });

    // Initial draws
    updateAllLayers();
    rebuildMarkers();

    if (showMarkersRef.current && showDensityRef.current && showSeverityRef.current) {
      showAllModesHint();
    }

    // Update on zoom/move
    map.on('zoomend moveend', () => {
      // Debounce so rapid movement doesnt lag
      if (moveDebounceRef.current) {
        clearTimeout(moveDebounceRef.current);
      }

      moveDebounceRef.current = setTimeout(() => {
        updateDensity();
        updateLegendForMode();

        if (showSeverityRef.current) {
          buildSeverityMarkers(); // full rebuild
        }

        const map = mapRef.current;
        if (!map) return;

        const z = map.getZoom();
        const r = markerRadiusForZoom(z);
        const currentSelectedId = selectedPostIdRef.current;

        // Build a lookup table
        const postsById = new Map(
          (postsRef.current || [])
            .filter(p => p && p.id != null)
            .map(p => [String(p.id), p])
        );

        markerByIdRef.current.forEach((mk, id) => {
          const p = postsById.get(String(id));
          if (!p) return;

          const sel = id === currentSelectedId;
          mk.setStyle(
            sel
              ? selectedStyleFor(p, p.disasterType, r)
              : styleFor(p, p.disasterType, r)
          );
        });
      }, 80);
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
    
    // Update circle marker styles
    markerByIdRef.current.forEach((mk, id) => {
      const p = postsRef.current.find(pp => pp.id === id);
      if (!p) return;
      mk.setStyle(
        id === selectedPostId 
        ? selectedStyleFor(p, p.disasterType, r) 
        : styleFor(p, p.disasterType, r)
      );
    });
    
    // Update severity marker states
    if (showSeverityRef.current) {
      updateSeverityMarkerStates();
    }
  }, [selectedPostId]);

  // Zoom to selected & open popup
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

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

    map.closePopup();

    const targetZoom = Math.max(map.getZoom(), SELECTION_ZOOM);
    const targetLatLng = L.latLng(lat, lng);

    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const needsMove = 
      currentCenter.distanceTo(targetLatLng) > 100 ||
      currentZoom < targetZoom;

    if (needsMove) {
      map.once('moveend', () => {
        if (selectedPostIdRef.current !== selectedPostId) return;
        
        const marker = markerByIdRef.current.get(selectedPostId);
        if (!marker) return;
        
        const popup = marker.getPopup();
        if (popup) {
          popup.setLatLng(targetLatLng);
          marker.openPopup();
        }
      });

      map.flyTo(targetLatLng, targetZoom, {
        animate: true,
        duration: 0.6,
      });
    } else {
      const popup = mk.getPopup();
      if (popup) {
        popup.setLatLng(targetLatLng);
      }
      mk.openPopup();
    }
  }, [selectedPostId]);

  return <div ref={mapEl} className="map" role="application" aria-label="Disaster map" />;
}
