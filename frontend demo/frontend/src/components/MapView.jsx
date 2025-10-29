import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import resetIconUrl from '../assets/resetZoom.png';

const MARKER_ZOOM_THRESHOLD = 0;
const SELECTION_ZOOM = 9;
const KM_PER_DEG = 111.32;

const HEAT = {
  RADIUSZ4: 28,
  RADIUSZ12: 10,
  BLUR_FACTOR: 0.35,
  MINOPACITY_Z4: 0.45,
  MINOPACITY_Z12: 0.06
};

const WORLD_BOUNDS = L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180));
const INITIAL_VIEW = { center: [20, 0], zoom: 2 };

// CSS var reader
const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// known type vars
const cssVarForType = (t) => {
  const key = String(t || '').toLowerCase();
  if (key === 'tornado')      return '--marker-tornado';
  if (key === 'earthquake')   return '--marker-earthquake';
  if (key === 'flood')        return '--marker-flood';
  if (key === 'thunderstorm') return '--marker-thunderstorm';
  return null;
};

// fallback palette for unknown types
const FALLBACK_PALETTE = [
  '#e53935', '#8e24aa', '#3949ab', '#00897b', '#7cb342',
  '#fb8c00', '#6d4c41', '#00838f', '#5e35b1', '#1e88e5'
];

// small helper to clamp
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export default function MapView({
  posts = [],
  selectedPostId = null,
  onSelectPost,
  onMissingCoords,
  onHasCoords
}) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);

  // keep latest posts
  const postsRef = useRef(posts);
  useEffect(() => { postsRef.current = posts; }, [posts]);

  // type -> color map
  const typeColorMapRef = useRef(new Map());
  const nextPaletteIdxRef = useRef(0);
  const colorForType = (type) => {
    const label = String(type || '').trim();
    if (!label) return cssVar('--marker-default') || '#3895ff';
    const hit = typeColorMapRef.current.get(label);
    if (hit) return hit;
    const varName = cssVarForType(label);
    if (varName) {
      const cv = cssVar(varName);
      if (cv) {
        typeColorMapRef.current.set(label, cv);
        return cv;
      }
    }
    const color = FALLBACK_PALETTE[nextPaletteIdxRef.current % FALLBACK_PALETTE.length];
    nextPaletteIdxRef.current += 1;
    typeColorMapRef.current.set(label, color);
    return color;
  };

  // panes & layers
  const markersRendererRef = useRef(null);
  const markersLayerRef = useRef(null);
  const markerByIdRef = useRef(new Map());

  const heatRef = useRef(null);
  const heatConfRef = useRef({ radius: 36, blur: 24, minOpacity: 0.5 });
  const heatStatsRef = useRef({ min: 0, q50: 0, max: 0 }); // posts per km live stats

  // mode state ('markers' | 'heat' | 'both')
  const modeRef = useRef('both');

  // z-aware helpers
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

  const heatConfigForZoom = (z) => {
    const zz = Math.max(4, Math.min(12, z));
    const t = (zz - 4) / 8; // 0 at z=4, 1 at z=12
    const radius = Math.round(HEAT.RADIUSZ4 + (HEAT.RADIUSZ12 - HEAT.RADIUSZ4) * t);
    const blur = Math.round(radius * HEAT.BLUR_FACTOR);
    const minOpacity = +(
      HEAT.MINOPACITY_Z4 + (HEAT.MINOPACITY_Z12 - HEAT.MINOPACITY_Z4) * t
    ).toFixed(2);
    return { radius, blur, minOpacity };
  };

  // marker sizing by zoom
  const markerRadiusForZoom = (z) => {
    if (z < 3)  return 3.5;
    if (z < 4)  return 6;
    if (z < 5)  return 8;
    if (z < 6)  return 10;
    if (z < 7)  return 12;
    if (z < 8)  return 14;
    if (z < 10) return 16;
    return 18; // your original radius at close zooms
  };

  // base/selected styles (radius injected at call site)
  const styleFor = (type, radius) => ({
    radius,
    weight: 2,
    opacity: 1,
    fillOpacity: 0.9,
    color: '#ffffff',
    fillColor: colorForType(type),
  });
  const selectedStyleFor = (type, radius) => ({
    ...styleFor(type, radius + 2),
    weight: 3,
  });

  const bringLayerToBack = (layer) => { if (layer?.bringToBack) layer.bringToBack(); };
  const bringLayerToFront = (layer) => { if (layer?.bringToFront) layer.bringToFront(); };

  // Build heat points + real density stats for legend
  const buildHeatData = (z) => {
    const cell = gridSizeForZoom(z);
    const roundTo = (v) => Math.round(v / cell) * cell;

    // "lat|lng" -> { lat, lng, count }
    const buckets = new Map();
    const arr = postsRef.current;
    for (const p of arr) {
      const lat = p.lat ?? p.latitude;
      const lng = p.lng ?? p.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      const latR = +roundTo(lat).toFixed(6);
      const lngR = +roundTo(lng).toFixed(6);
      const key = `${latR}|${lngR}`;
      const prev = buckets.get(key);
      if (prev) prev.count += 1;
      else buckets.set(key, { lat: latR, lng: lngR, count: 1 });
    }

    // posts per km for each cell
    const toDensity = ({ lat, lng, count }) => {
      const latKm  = KM_PER_DEG * cell;
      const lonKm  = KM_PER_DEG * Math.cos((lat * Math.PI) / 180) * cell;
      const areaKm2 = Math.max(1e-6, latKm * lonKm);
      return { lat, lng, d: count / areaKm2 };
    };
    const dens = Array.from(buckets.values()).map(toDensity);
    const maxD = dens.reduce((m, x) => Math.max(m, x.d), 0) || 1;
    const minD = dens.reduce((m, x) => Math.min(m, x.d), maxD) || 0;
    const sorted = dens.map(x => x.d).sort((a,b)=>a-b);
    const mid = sorted.length ? sorted[Math.floor(sorted.length/2)] : 0;

    // Normalize for Leaflet.heat
    const pts = dens.map(({ lat, lng, d }) => [lat, lng, clamp01(d / maxD)]);
    return { pts, stats: { min: minD, q50: mid, max: maxD } };
  };

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

// TYPE legend HTML using the types present in current posts
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
      <div class="legend-title">Disaster types</div>
      ${rows}
    </section>
  `;
};

  const updateLegendForMode = () => {
    if (!legendVisibleRef.current || !legendElRef.current) return;
  const m = modeRef.current;

  if (m === 'heat') {
    // Only density (heat) legend
    legendElRef.current.innerHTML = getDensityLegendHTML();
  } else if (m === 'markers') {
    // Only type legend
    legendElRef.current.innerHTML = getTypeLegendHTML();
  } else {
    // both
    legendElRef.current.innerHTML = `
      <div class="legend-combined">
        ${getDensityLegendHTML()}
        ${getTypeLegendHTML()}
      </div>
    `;
  }
  };

  // Rebuild heat
  const updateHeat = () => {
    if (!mapRef.current) return;
    const z = mapRef.current.getZoom();
    const { pts, stats } = buildHeatData(z);
    const conf = heatConfigForZoom(z);

    // stash stats for legend
    heatStatsRef.current = stats;

    const same =
      heatConfRef.current.radius === conf.radius &&
      heatConfRef.current.blur === conf.blur &&
      heatConfRef.current.minOpacity === conf.minOpacity;

    if (!heatRef.current || !same) {
      if (heatRef.current) heatRef.current.remove();
      heatRef.current = L.heatLayer(pts, {
        radius: conf.radius,
        blur: conf.blur,
        minOpacity: conf.minOpacity,
        pane: 'heat',
        gradient: {
          0.00: '#e6fffb',
          0.35: '#99f6e4',
          0.70: '#2dd4bf',
          1.00: '#0f766e'
        }
      }).addTo(mapRef.current);
      heatConfRef.current = conf;
      bringLayerToBack(heatRef.current);
    } else {
      heatRef.current.setLatLngs(pts);
      bringLayerToBack(heatRef.current);
    }
    updateLegendForMode();
  };

  // Rebuild markers
  const rebuildMarkers = () => {
    if (!mapRef.current) return;

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

      const popupHtml = `
        <div style="max-width:260px;line-height:1.25">
          <div style="font-weight:600;margin-bottom:4px">@${(p.username || 'unknown')}</div>
          <div style="margin-bottom:6px">${(p.text || '').replace(/</g,'&lt;')}</div>
          <div style="font-size:12px;opacity:.8">
            ${(p.disasterType ? `Type: ${p.disasterType} · ` : '')}
            ${p.createdAt ? new Date(p.createdAt).toLocaleString() : ''}
          </div>
        </div>
      `;

      const mk = L.circleMarker([lat, lng], {
        ...styleFor(p.disasterType, r),
        pane: 'markers',
        renderer: markersRendererRef.current,
      })
      .bindPopup(popupHtml, { autoPan: false, className: 'post-popup' })
      .on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (selectedPostId === p.id) onSelectPost?.(null);
        else onSelectPost?.(p.id);
      });

      mk.addTo(markersLayerRef.current);
      markerByIdRef.current.set(p.id, mk);
    });

    // highlight selected
    if (selectedPostId != null) {
      const sel = markerByIdRef.current.get(selectedPostId);
      const p = postsRef.current.find(pp => pp.id === selectedPostId);
      if (sel && p) sel.setStyle(selectedStyleFor(p.disasterType, r));
    }

    bringLayerToFront(markersLayerRef.current); // markers above heat
  };

  // show/hide panels
  const legendControlRef = useRef(null);
  const legendElRef = useRef(null);
  const legendToggleControlRef = useRef(null);
  const legendVisibleRef = useRef(false);

  const setLegendVisible = (want) => {
    legendVisibleRef.current = !!want;
    const ctrl = legendControlRef.current;
    if (!ctrl || !ctrl._container) return;
    ctrl._container.style.display = want ? 'block' : 'none';

    // toggle chip state
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

  // initialize map
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

    // ensure size
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

    // panes
    map.createPane('heat');
    map.createPane('markers');
    const heatPane = map.getPane('heat');
    const markersPane = map.getPane('markers');
    const popupPane = map.getPane('popupPane');
    if (heatPane)    heatPane.style.zIndex = 200;
    if (markersPane) markersPane.style.zIndex = 600;
    if (popupPane)   popupPane.style.zIndex = 800;

    // renderer for markers
    markersRendererRef.current = L.canvas({ padding: 0.5, pane: 'markers' });

    // Zoom control (top-right)
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Reset View (bottom-left)
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

    map.on('click', () => {
      onSelectPost?.(null);
      map.closePopup();
    });

    // Legend panel (bottom-right)
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

    // Legend toggle chip (bottom-right)
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

    // Modes control
    const modesEl = L.DomUtil.create('div', 'map-modes map-modes--center', map.getContainer());
    modesEl.innerHTML = `
    <div role="group" aria-label="Map display mode" class="map-modes-inner">
      <button class="chip mode-btn mode-btn--square" data-mode="markers">Markers</button>
      <button class="chip mode-btn mode-btn--square" data-mode="heat">Heatmap</button>
      <button class="chip mode-btn mode-btn--square active" data-mode="both">Both</button>
    </div>
    `;

    // prevent map drags when interacting with the modes bar
    L.DomEvent.disableClickPropagation(modesEl);
    L.DomEvent.on(modesEl, 'mousewheel', L.DomEvent.stopPropagation);

    // wire up clicks
    modesEl.querySelectorAll('.mode-btn').forEach(btn => {
      L.DomEvent.on(btn, 'click', (e) => {
        L.DomEvent.stopPropagation(e);
        const mode = btn.getAttribute('data-mode');
        modeRef.current = mode;

      // toggle active button styles
      modesEl.querySelectorAll('.mode-btn')
        .forEach(b => b.classList.toggle('active', b === btn));

      // show/hide layers based on mode
      if (mode === 'markers') {
        if (heatRef.current && map.hasLayer(heatRef.current)) {
      map.removeLayer(heatRef.current);
      }
      // ensure markers are on
      if (markersLayerRef.current && !map.hasLayer(markersLayerRef.current)) {
      markersLayerRef.current.addTo(map);
      }
      bringLayerToFront(markersLayerRef.current);
      } else if (mode === 'heat') {
        if (heatRef.current && !map.hasLayer(heatRef.current)) {
        heatRef.current.addTo(map);
      }
  
      if (markersLayerRef.current && map.hasLayer(markersLayerRef.current)) {
        map.removeLayer(markersLayerRef.current);
      }
      bringLayerToBack(heatRef.current);
        } else { // both
          if (heatRef.current && !map.hasLayer(heatRef.current)) {
            heatRef.current.addTo(map);
          }
          if (markersLayerRef.current && !map.hasLayer(markersLayerRef.current)) {
            markersLayerRef.current.addTo(map);
          }
          bringLayerToBack(heatRef.current);
          bringLayerToFront(markersLayerRef.current);
        }

      updateLegendForMode();
      });
    });

    // First draws
    updateHeat();
    rebuildMarkers();
    bringLayerToBack(heatRef.current);
    bringLayerToFront(markersLayerRef.current);

    // Update on zoom/move
    map.on('zoomend moveend', () => {
      updateHeat();
      // restyle markers w/ zoom radius
      const z = map.getZoom();
      const r = markerRadiusForZoom(z);
      markerByIdRef.current.forEach((mk, id) => {
        const p = postsRef.current.find(pp => pp.id === id);
        if (!p) return;
        const sel = (id === selectedPostId);
        mk.setStyle(sel ? selectedStyleFor(p.disasterType, r) : styleFor(p.disasterType, r));
      });

    });
  }, []);

  // Rebuild when posts change
  useEffect(() => {
    if (!mapRef.current) return;
    updateHeat();
    rebuildMarkers();
  }, [posts]);

  // Reselect styling
  useEffect(() => {
    if (!mapRef.current) return;
    const z = mapRef.current.getZoom();
    const r = markerRadiusForZoom(z);
    markerByIdRef.current.forEach((mk, id) => {
      const p = postsRef.current.find(pp => pp.id === id);
      if (!p) return;
      mk.setStyle(id === selectedPostId ? selectedStyleFor(p.disasterType, r) : styleFor(p.disasterType, r));
    });
  }, [selectedPostId]);

  //zoom to post open popup
  useEffect(() => {
  const map = mapRef.current;
  if (!map) return;

  // If clearing selection, close 
  if (selectedPostId == null) {
    map.closePopup();
    return;
  }

  // Resolve the selected post
  const p = (postsRef.current || []).find(pp => pp.id === selectedPostId);
  if (!p) return;

  const lat = p.lat ?? p.latitude;
  const lng = p.lng ?? p.longitude;

  // Missing coords banner
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    onMissingCoords?.(p);
    return;
  }

  onHasCoords?.();

  // Get the marker instance; if missing no
  const mk = markerByIdRef.current.get(selectedPostId);
  if (!mk) return;

  const alreadyOpen = mk.isPopupOpen && mk.isPopupOpen();
  const targetZoom = Math.max(map.getZoom(), SELECTION_ZOOM);
  const targetLatLng = L.latLng(lat, lng);

  map.flyTo(targetLatLng, targetZoom, { duration: 0.6, easeLinearity: 0.25 });

  // Open popup exactly once, after the movement finishes
  const openAfterMove = () => {
    // Re-check marker in case layers changed
    const fresh = markerByIdRef.current.get(selectedPostId);
    if (!fresh) return;
    if (!fresh.isPopupOpen || !fresh.isPopupOpen()) {
      fresh.openPopup();
    }
    map.off('moveend', openAfterMove);
  };

  if (alreadyOpen) {
    // If already open, keep it
  } else {
    map.on('moveend', openAfterMove);
  }

  // Cleanup in case selection changes mid-animation
  return () => map.off('moveend', openAfterMove);
}, [selectedPostId]);

  return (
    <div className="map" ref={mapEl} aria-label="Disaster map" />
  );
}
