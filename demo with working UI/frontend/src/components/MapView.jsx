import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

const MARKER_ZOOM_THRESHOLD = 5.5; // show markers at/after this zoom
const SELECTION_ZOOM = 9;          // zoom level to focus a selected post
const KM_PER_DEG = 111.32;         // km per lat degree
const HEAT = {                      // heat map scaling
  RADIUSZ4: 28,
  RADIUSZ12: 10,
  BLUR_FACTOR: 0.35,
  MINOPACITY_Z4: 0.45,
  MINOPACITY_Z12: 0.06
};

const WORLD_BOUNDS = L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180));

// read a CSS var from root
const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Known CSS var names for common disaster types
const cssVarForType = (t) => {
  const key = String(t || '').toLowerCase();
  if (key === 'tornado')      return '--marker-tornado';
  if (key === 'earthquake')   return '--marker-earthquake';
  if (key === 'flood')        return '--marker-flood';
  if (key === 'thunderstorm') return '--marker-thunderstorm';
  return null; // unknown => try default or palette
};

// used for any new/unknown types from backend
const FALLBACK_PALETTE = [
  '#e53935', '#8e24aa', '#3949ab', '#00897b', '#7cb342',
  '#fb8c00', '#6d4c41', '#00838f', '#5e35b1', '#1e88e5'
];

export default function MapView({
  posts = [],
  selectedPostId = null,
  onSelectPost,
  onMissingCoords,
}) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);

  // latest posts ref
  const postsRef = useRef(posts);

  // dynamic type -> color map
  const typeColorMapRef = useRef(new Map());
  const nextPaletteIdxRef = useRef(0);

  // pick a color helper
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

  // leaflet layer refs
  const markersRendererRef = useRef(null);
  const heatRef = useRef(null);
  const heatConfRef = useRef({ radius: 36, blur: 24, minOpacity: 0.5 });
  const markersLayerRef = useRef(null);
  const markerByIdRef = useRef(new Map());

  // safe layer ordering helpers
  const bringLayerToBack = (layer) => {
    if (layer && typeof layer.bringToBack === 'function') layer.bringToBack();
  };
  const bringLayerToFront = (layer) => {
    if (layer && typeof layer.bringToFront === 'function') layer.bringToFront();
  };

  // marker styles
  const baseStyle = (type) => ({
    radius: 10,
    weight: 2,
    opacity: 1,
    fillOpacity: 0.9,
    color: '#ffffff',
    fillColor: colorForType(type),
  });
  const selectedStyle = (type) => ({
    ...baseStyle(type),
    radius: 12,
    weight: 3,
  });

  const safeSetStyle = (mk, styleObj) => {
    if (mk && typeof mk.setStyle === 'function') mk.setStyle(styleObj);
  };

  const restyleAll = (selectedId) => {
    const arr = postsRef.current;
    markerByIdRef.current.forEach((mk, id) => {
      const post = arr.find((pp) => pp.id === id);
      if (!post) return;
      safeSetStyle(mk, id === selectedId ? selectedStyle(post.disasterType) : baseStyle(post.disasterType));
    });
  };

  // heat map helper (change return values for bigger or smaller blob)
  const gridSizeForZoom = (z) => {
    if (z <= 4)  return 0.65;
    if (z <= 5)  return 0.33;
    if (z <= 6)  return 0.17;
    if (z <= 7)  return 0.1;
    if (z <= 8)  return 0.07;
    if (z <= 9)  return 0.045;
    if (z <= 10) return 0.027;
    if (z <= 11) return 0.018;
    if (z <= 12) return 0.011;
    return 0.007;
  };

  const buildHeatPoints = (z) => {
    const cell = gridSizeForZoom(z);
    const roundTo = (v) => Math.round(v / cell) * cell;

    const buckets = new Map(); // "lat|lng" -> { lat, lng, count }
    const arr = (typeof postsRef === 'object' && postsRef?.current) ? postsRef.current : posts;

    arr.forEach((p) => {
      const lat = p.lat ?? p.latitude;
      const lng = p.lng ?? p.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') return;

      const latR = +roundTo(lat).toFixed(6);
      const lngR = +roundTo(lng).toFixed(6);
      const key = `${latR}|${lngR}`;
      const prev = buckets.get(key);
      if (prev) prev.count += 1;
      else buckets.set(key, { lat: latR, lng: lngR, count: 1 });
    });

    // Convert post count -> density
    const toDensity = ({ lat, lng, count }) => {
      const latKm  = KM_PER_DEG * cell;
      const lonKm  = KM_PER_DEG * Math.cos((lat * Math.PI) / 180) * cell;
      const areaKm2 = Math.max(1e-6, latKm * lonKm);
      return { lat, lng, density: count / areaKm2 };
    };

    const dens = Array.from(buckets.values()).map(toDensity);

    // normalize by max density at current zoom
    const maxD = dens.reduce((m, x) => Math.max(m, x.density), 0) || 1;
    return dens.map(({ lat, lng, density }) => [lat, lng, Math.min(1, density / maxD)]);
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

  const updateHeat = () => {
    if (!mapRef.current) return;
    const z = mapRef.current.getZoom();
    const pts = buildHeatPoints(z);
    const conf = heatConfigForZoom(z);

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
      }).addTo(mapRef.current);
      heatConfRef.current = conf;

      bringLayerToBack(heatRef.current); // keep heat always behind
    } else {
      heatRef.current.setLatLngs(pts);
      bringLayerToBack(heatRef.current);
    }
  };

  // markers
  const rebuildMarkers = () => { 
    if (!mapRef.current) return;

    if (!markersLayerRef.current) {
      markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
    } else {
      markersLayerRef.current.clearLayers();
    }
    markerByIdRef.current.clear();

    const z = mapRef.current.getZoom();
    if (z < MARKER_ZOOM_THRESHOLD) return;

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

      const cm = L.circleMarker([lat, lng], {
        ...baseStyle(p.disasterType),
        pane: 'markers',
        renderer: markersRendererRef.current,
      })
        .bindPopup(popupHtml, { autoPan: false, className: 'post-popup' })
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (selectedPostId === p.id) onSelectPost?.(null);
          else onSelectPost?.(p.id);
        });

      cm.addTo(markersLayerRef.current);
      markerByIdRef.current.set(p.id, cm);
    });

    if (selectedPostId != null) restyleAll(selectedPostId);

    bringLayerToFront(markersLayerRef.current); // markers above heat
  };

  // legend
  const legendControlRef = useRef(null);       
  const legendElRef = useRef(null);            
  const legendToggleControlRef = useRef(null); 
  const legendVisibleRef = useRef(false);

  const renderLegend = () => {
    if (!legendElRef.current) return;
    const uniqueTypes = Array.from(
      new Set(postsRef.current.map(p => String(p.disasterType || '').trim()).filter(Boolean))
    ).sort();

    const rows = uniqueTypes.map(t => {
      const color = colorForType(t);
      return `
        <div class="legend-row">
          <span class="legend-swatch" style="background:${color}"></span>
          <span>${t}</span>
        </div>
      `;
    }).join('') || '<div class="legend-row"><span>No types</span></div>';

    legendElRef.current.innerHTML = rows;
  };

  // show/hide legend panel
  const setLegendVisible = (want) => {
    legendVisibleRef.current = !!want;
    const ctrl = legendControlRef.current;
    if (!ctrl || !ctrl._container) return;
    ctrl._container.style.display = want ? 'block' : 'none';

    // active state on the toggle chip
    const tgl = legendToggleControlRef.current;
    if (tgl && tgl._container) {
      const btn = tgl._container.querySelector('button.legend-toggle');
      if (btn) btn.classList.toggle('active', !!want);
    }
  };

  // initialization
  useEffect(() => {
    if (!mapRef.current && mapEl.current) {
      const map = L.map(mapEl.current, {
        center: [20, 0],
        zoom: 2,
        minZoom: 2,
        preferCanvas: true,
        zoomControl: false,
        maxBounds: WORLD_BOUNDS,   
        maxBoundsViscosity: 1.0,   
        worldCopyJump: true
      });
      mapRef.current = map;

      // Ensure map has size before any canvas draws
      const resizeOnce = () => map.invalidateSize(false);
      if (document.readyState === 'complete') {
        setTimeout(resizeOnce, 0);
      } else {
        window.addEventListener('load', resizeOnce, { once: true });
      }
      const ro = new ResizeObserver(() => map.invalidateSize(false));
      ro.observe(mapEl.current);

      //zoom in topright
      L.control.zoom({ position: 'topright' }).addTo(map);

      L.tileLayer(
        'https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.{ext}',
        {
          minZoom: 0,
          maxZoom: 20,
          ext: 'png',
          noWrap: true,
          bounds: WORLD_BOUNDS,
          attribution:
            '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> ' +
            '&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> ' +
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
        }
      ).addTo(map);

      // Create panes
      map.createPane('heat');
      map.createPane('markers');

      // z indexs
      const heatPane = map.getPane('heat');
      const markersPane = map.getPane('markers');
      const popupPane = map.getPane('popupPane');

      if (heatPane)    heatPane.style.zIndex = 200;
      if (markersPane) markersPane.style.zIndex = 600;
      if (popupPane)   popupPane.style.zIndex = 800;

      // draws into markers pane
      markersRendererRef.current = L.canvas({ padding: 0.5, pane: 'markers' });

      // Legend control
      const legend = L.control({ position: 'bottomright' });
      legend.onAdd = function () {
        const wrapper = L.DomUtil.create('div', 'map-legend');
        wrapper.style.display = 'none'; // hidden until toggled
        const inner = L.DomUtil.create('div', 'map-legend-inner', wrapper);
        legendElRef.current = inner;
        L.DomEvent.disableClickPropagation(wrapper);
        return wrapper;
      };
      legend.addTo(map);
      legendControlRef.current = legend;

      // legend toggle button
      const legendToggle = L.control({ position: 'bottomright' });
      legendToggle.onAdd = function () {
        const c = L.DomUtil.create('div', 'leaflet-control');
        c.innerHTML = `
          <button type="button" class="chip legend-toggle" aria-pressed="false" title="Show legend">
            See Legend
          </button>
        `;
        const btn = c.querySelector('button.legend-toggle');

        // stop map when using the button
        L.DomEvent.disableClickPropagation(c);
        L.DomEvent.on(btn, 'click', (e) => {
          L.DomEvent.stopPropagation(e);
          const next = !legendVisibleRef.current;
          setLegendVisible(next);
          btn.setAttribute('aria-pressed', String(next));
          btn.title = next ? 'Hide legend' : 'Show legend';
        });

        return c;
      };
      legendToggle.addTo(map);
      legendToggleControlRef.current = legendToggle;

      // update both heat + markers on zoom
      const onZoom = () => {
        updateHeat();
        rebuildMarkers();
      };
      map.on('zoomend', onZoom);

      // clicking on empty map clears selection + closes popup
      map.on('click', () => {
        map.closePopup();
        onSelectPost?.(null);
      });

      // first render
      updateHeat();
      rebuildMarkers();
      renderLegend();

      // cleanup
      return () => {
        try { ro.disconnect(); } catch {}
        try { map.off('zoomend', onZoom); } catch {}
        try { map.remove(); } catch {}
        mapRef.current = null;
      };
    }
  }, []);

  // Redo overlays + legend when posts change
  useEffect(() => {
    if (!mapRef.current) return;
    postsRef.current = posts;

    // refresh color for any brand-new types
    Array.from(new Set(posts.map(p => String(p.disasterType || '').trim()).filter(Boolean)))
      .forEach(t => { void colorForType(t); });

    updateHeat();
    rebuildMarkers();
    renderLegend();
  }, [posts]);

  useEffect(() => {
    if (!mapRef.current) return;

    // unclick restores styles & closes popup
    if (selectedPostId == null) {
      restyleAll(null);
      mapRef.current.closePopup();
      return;
    }

    const map = mapRef.current;

    const centerOnId = (postId) => {
      const mk = markerByIdRef.current.get(postId);
      if (!mk) return;
      const ll = mk.getLatLng();
      const targetZoom = Math.max(map.getZoom(), SELECTION_ZOOM);

      const openFreshPopup = () => {
        const fresh = markerByIdRef.current.get(postId);
        if (fresh && typeof fresh.openPopup === 'function') {
          fresh.openPopup();
        }
        restyleAll(postId);
        map.off('moveend', openFreshPopup);
      };
      map.on('moveend', openFreshPopup);

      if (map.getZoom() === targetZoom) {
        map.panTo(ll, { animate: true, duration: 0.5 });
      } else {
        map.flyTo(ll, targetZoom, { animate: true, duration: 0.5 });
      }
    };

    const mk = markerByIdRef.current.get(selectedPostId);
      if (mk) {
        centerOnId(selectedPostId);
      } else {
        // No coordinates/marker for this post — do NOT zoom or pan.
        const post = postsRef.current.find(p => p.id === selectedPostId);
        if (post && typeof onMissingCoords === 'function') {
          onMissingCoords(post);
        }
        return;
      }
    }, [selectedPostId]);

  return <div ref={mapEl} className="map" />;
}