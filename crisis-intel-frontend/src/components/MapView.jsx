import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function MapView({ heat = [] }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const heatRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current && mapEl.current) {
      // Center on US
      mapRef.current = L.map(mapEl.current, {
        center: [39.5, -98.35], 
        zoom: 4,
      });

      // Stadia.Outdoors tile layer
      L.tileLayer(
        'https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.{ext}',
        {
          minZoom: 0,
          maxZoom: 20,
          ext: 'png',
          attribution:
            '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> ' +
            '&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> ' +
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
        }
      ).addTo(mapRef.current);

      // create empty heat layer
      heatRef.current = L.heatLayer([], {
        radius: 36,      //how big points are
        blur: 24,        // how much the colors blend
        maxZoom: 5,     // how it scales when zooming in
        minOpacity: 5   //keep visibility when zoomed out
      }).addTo(mapRef.current);
    }

    // Update heat data whenever props.heat changes
    if (mapRef.current && heatRef.current) {
      // normalize to [[lat, lng, intensity]]
      const points = heat
        .map((p) => Array.isArray(p)
          ? p
          : [p.lat ?? p.latitude, p.lng ?? p.longitude, p.intensity ?? p.count ?? 1]
        )
        .filter((arr) => typeof arr[0] === 'number' && typeof arr[1] === 'number');

      heatRef.current.setLatLngs(points);

      // fit bounds if we have points
      if (points.length > 0) {
        const latlngs = points.map(([lat, lng]) => [lat, lng]);
        const bounds = L.latLngBounds(latlngs);
        mapRef.current.fitBounds(bounds.pad(0.2));
      }
    }
  }, [heat]);

  return <div ref={mapEl} className="map" />;
}