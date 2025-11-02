import React, { useEffect, useMemo, useState } from "react";
import { getTypeColor } from "../theme/typeColors";
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area,
    XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer, Cell
} from "recharts";
import "../App.css";
import logoUrl from "../assets/logo.png"
import zoomInPng from "../assets/zoom-in.png";
import zoomOutPng from "../assets/zoom-out.png";

/*keep dark mode*/
function useEnsureTheme() {
    useEffect(() => {
        const cookie = document.cookie || "";
        const isDark = /(?:^|;\s*)dark_theme=true(?:;|$)/.test(cookie);
        const root = document.documentElement;
        if (isDark) root.classList.add("dark-theme");
        else root.classList.remove("dark-theme");
    }, []);
}

/*small UI wrapper*/
function Card({ title, children, subtitle, onZoom, isFocused }) {  
    return (
        <section className="list-box chart-card" style={{ position: "relative" }}>
      {/* zoom toggle (top-right) */}
      {onZoom ? (
        <button
          type="button"
          aria-label={isFocused ? "Zoom out" : "Zoom in"}
          title={isFocused ? "Zoom out" : "Zoom in"}
          onClick={onZoom}
          className="zoom-btn zoom-btn--topright"
        >
          <img
            src={isFocused ? zoomOutPng : zoomInPng}
            alt=""
            className="zoom-btn__icon"
          />
        </button>
      ) : null}

      {title ? <h2 className="col-title" style={{ marginBottom: 4 }}>{title}</h2> : null}
      {subtitle ? (
        <p className="meta" style={{ margin: "4px 0 12px", lineHeight: 1.35 }}>{subtitle}</p>
      ) : null}
      {children}
    </section>
  );
}

/* grid 2x2 */
function ChartGrid({ children }) {
    return <div className="cards-grid">{children}</div>;
}

/* tooltip- changed for darkmode*/
const DarkTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const rows = payload.filter(p => Number(p.value) > 0);
    if (!rows.length) return null;
    return (
        <div style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            color: "var(--text)",
            borderRadius: 8,
            padding: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale"
        }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
            {rows.map((p, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{
                    display: "inline-block", width: 10, height: 10, borderRadius: 2,
                    background: p.color || p.stroke || "var(--text)"
                }} />
            <span>{p.name}</span>
            <span style={{ marginLeft: "auto" }}>{p.value}</span>
            </div>
        ))}
        </div>
    );
};

const canon = s => String(s ?? "").trim().toLowerCase();

function toDayBucket(d) {
    const date = (d instanceof Date) ? d : new Date(d);
    if (Number.isNaN(date.getTime())) return null;
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function dayRangeInclusive(minDate, maxDate) {
    const out = [];
    const d = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), minDate.getUTCDate()));
    const end = new Date(Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth(), maxDate.getUTCDate()));
    while (d <= end) {
        out.push(toDayBucket(d));
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
}

/* tall wide rows for recharts*/
function pivotTallToWide(rows, bucketKey, categoryKey, valueKey, orderedBuckets, categories) {
    const byBucket = new Map();
    for (const r of rows) {
        const b = r[bucketKey];
        const k = r[categoryKey];
        const v = Number(r[valueKey] ?? 0);
        if (!b || !k) continue;
        if (!byBucket.has(b)) byBucket.set(b, { [bucketKey]: b });
        byBucket.get(b)[k] = (byBucket.get(b)[k] || 0) + v;
    } 
    return orderedBuckets.map(b => {
        const row = { [bucketKey]: b };
        for (const c of categories) row[c] = (byBucket.get(b)?.[c]) ?? 0;
        return row;
    });
}

/*Chart 1: Top Types (bar) */
function TopTypesBar({ onZoom, isFocused }) {
    const [rows, setRows] = useState([]);
    useEffect(() => {
        fetch("/analytics/top-types")
        .then(r => r.json())
        .then(setRows)
        .catch(console.error);
    }, []);

    const data = useMemo(
        () => rows.map(r => ({ type: (r?._id ?? "unknown").replace(/^./, c => c.toUpperCase()), count: Number(r?.count ?? 0) })),
        [rows]
    );

    return (
        <Card
            title="Top Disaster Types — Total Posts"                             
            subtitle="Which hazard categories have the most posts overall."
            onZoom={onZoom}
            isFocused = {isFocused} 
        >
            <div style={{ width: "100%", height: isFocused ? 600 : 320 }}>
                <ResponsiveContainer>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                        <XAxis dataKey="type" stroke="var(--text)" />
                        <YAxis stroke="var(--text)" />
                        <Tooltip content={<DarkTooltip />} cursor={{ fill: 'var(--chart-cursor)' }}/>
                        <Bar dataKey="count">
                            {data.map((row, i) => {
                                const fill = getTypeColor(row.type);
                                return <Cell key={i} fill={fill} />;
                            })}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}

/* Chart 2: Posts Over Time (line)*/
function PostsOverTime({ onZoom, isFocused }) {
    const [rows, setRows] = useState([]);
    useEffect(() => {
        fetch("/analytics/posts-over-time")
            .then(res => res.json())
            .then(setRows)
            .catch(console.error);
    }, []);

    const data = useMemo(
        () => (rows || []).map(d => ({
            date: d?._id,
            count: Number(d?.count ?? 0)
        })),
        [rows]
    );

    return (
        <Card
            title="Daily Post Volume"                              
            subtitle="Total posts per day across BlueSky stream."
            onZoom={onZoom}
            isFocused = {isFocused}          
        >
        <div style={{ width: "100%", height: isFocused ? 600 : 320 }}>
        <ResponsiveContainer>
            <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="date" stroke="var(--text)" />
                <YAxis stroke="var(--text)" />
                <Tooltip content={<DarkTooltip />} cursor={{ stroke: 'transparent', fill: 'var(--chart-cursor)' }} />
                <Legend />
                <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#6cb7daff" 
                    strokeWidth={2} 
                    dot={false} 
                    activeDot={{ r: 4 }} 
                />
            </LineChart>
        </ResponsiveContainer>
        </div>
        </Card>
    );
}

/* Chart 3: Top Countries Over Time (line) NOT WORKING*/
function TopCountriesOverTimeLine({ limit = 5, days = 30, onZoom, isFocused }) {
    const [rows, setRows] = useState([]);
    
    useEffect(() => {
        fetch(`/analytics/top-countries-over-time?limit=${limit}&days=${days}`)
        .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
        })
        .then(d => { console.log("top-countries data", d); setRows(d); })
        .catch(console.error);
    }, [limit, days]);

    // find the countries present in this window
    const countries = useMemo(() => {
        const set = new Set((rows || []).map(r => r.country).filter(Boolean));
        return Array.from(set);
    }, [rows]);

    // get date range and build continuous buckets
    const data = useMemo(() => {
        if (!rows.length) return [];
        const dates = rows.map(r => new Date(r.bucket)).filter(d => !Number.isNaN(d));
        if (!dates.length || !countries.length) return [];
        const min = new Date(Math.min(...dates));
        const max = new Date(Math.max(...dates));
        const buckets = dayRangeInclusive(min, max);
        return pivotTallToWide(rows, "bucket", "country", "count", buckets, countries);
    }, [rows, countries]);

    return (
        <Card
            title={`Top 5 Countries — Daily Posts`}  
            subtitle="Daily Post counts for the Top Posting."
            onZoom={onZoom}
            isFocused={isFocused}
            >
            <div style={{ width: "100%", height: isFocused ? 600 : 320 }}>
                <ResponsiveContainer>
                    <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                    <XAxis dataKey="bucket" stroke="var(--text)" />
                    <YAxis stroke="var(--text)" />
                    <Tooltip content={<DarkTooltip />} cursor={{ stroke: 'transparent', fill: 'var(--chart-cursor)' }} />
                    <Legend />
                    {countries.map((c) => (
                    <Line
                        key={c}
                        type="monotone"
                        dataKey={c}
                        stroke={getTypeColor(c)}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                        hide={data.every(row => (row[c] ?? 0) === 0)}
                    />
                    ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}

/* Chart 4: Types Over Time (stacked area) */
function TypesOverTimeStacked({ topK = 5, onZoom, isFocused }) {
    const [rows, setRows] = useState([]);

    useEffect(() => {
        fetch(`/analytics/types-over-time`)
        .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        })
        .then(data => setRows(Array.isArray(data) ? data : []))
        .catch(console.error);
    }, []);

    const { data, keys } = useMemo(() => {
        if (!rows.length) return { data: [], keys: [] };

    const totals = new Map();
    for (const r of rows) {
        const t = canon(r.type || "other");
        totals.set(t, (totals.get(t) || 0) + Number(r.count || 0));
    }

    const ordered = Array.from(totals.entries())
        .sort((a, b) => b[1] - a[1])           
        .map(([t]) => t);

    const chosen = ordered.filter(t => t !== "other").slice(0, topK);
    const allKeys = [...chosen, "other"];

    const remappedTall = rows.map(r => {
        const t = canon(r.type || "other");
        const mappedType = chosen.includes(t) ? t : "other";
        return { bucket: r.bucket, type: mappedType, count: Number(r.count || 0) };
    });

    const dates = remappedTall.map(r => new Date(r.bucket));
    const min = new Date(Math.min(...dates));
    const max = new Date(Math.max(...dates));
    const buckets = dayRangeInclusive(min, max);

    const wide = pivotTallToWide(
        remappedTall,
        "bucket",
        "type",
        "count",
        buckets,
        allKeys
    );

    return { data: wide, keys: allKeys };
    }, [rows, topK]);

    const colorForKey = (k) => {
        if (k === "other") return "var(--muted-2)";
        return getTypeColor(k);
    };

    return (
        <Card
            title="Daily Posts by Disaster Type — Stacked"
            subtitle="Daily totals split by hazard type; minor types are grouped into “Other”."
            onZoom={onZoom}
            isFocused ={isFocused}
        >
            <div style={{ width: "100%", height: isFocused ? 600 : 320 }}>
                <ResponsiveContainer>
                    <AreaChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                        <XAxis dataKey="bucket" stroke="var(--text)" />
                        <YAxis stroke="var(--text)" />
                        <Tooltip content={<DarkTooltip />} cursor={{ stroke: 'transparent', fill: 'var(--chart-cursor)' }} />
                        <Legend />
                        {keys.map((k) => {
                            const c = colorForKey(k);
                            return(
                                <Area
                                    key={k}
                                    type="monotone"
                                    dataKey={k}
                                    stackId="1"
                                    stroke={c}
                                    fill={c}
                                    fillOpacity={0.5}
                                    strokeWidth={2}
                                    hide={data.every(row => (row?.[k] ?? 0) === 0)}
                                />
                            );
                        })}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}

/* Page*/
export default function Analytics() {
    useEnsureTheme();
    
    const [focusKey, setFocusKey] = useState(null);
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') setFocusKey(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const [totalPosts, setTotalPosts] = useState(null);
    useEffect(() => {
        fetch('/analytics/total-posts')
        .then(r => r.json())
        .then(d => setTotalPosts(typeof d?.total === 'number' ? d.total : null))
        .catch(() => setTotalPosts(null));
    }, []);

    return (
        <div className="grid-3-col">
      <section className="list-box analytics-header">
        <h2 className="col-title">Analytics</h2>
        <p className="meta" style={{ marginTop: 4 }}>
          These charts aggregate the same posts you see on the map/list!
        </p>
        <p className="total-line" style={{ marginTop: 6, fontWeight: 600 }}>
          <span className="total-number">
            {totalPosts == null ? '—' : totalPosts.toLocaleString()}
          </span>{" "}
          Total Posts
        </p>
      </section>

      {/* Either 2×2 grid or single chart */}
      {!focusKey ? (
        <ChartGrid>
          <TopTypesBar
            onZoom={() => setFocusKey('top-types')}
            isFocused={false}
          />
          <PostsOverTime
            onZoom={() => setFocusKey('posts-over-time')}
            isFocused={false}
          />
          <TopCountriesOverTimeLine
            limit={5}
            onZoom={() => setFocusKey('top-countries')}
            isFocused={false}
          />
          <TypesOverTimeStacked
            topK={5}
            onZoom={() => setFocusKey('types-stacked')}
            isFocused={false}
          />
        </ChartGrid>
      ) : (
        <div>
            {focusKey === 'top-types' && (
              <TopTypesBar onZoom={() => setFocusKey(null)} isFocused />
            )}
            {focusKey === 'posts-over-time' && (
              <PostsOverTime onZoom={() => setFocusKey(null)} isFocused />
            )}
            {focusKey === 'top-countries' && (
              <TopCountriesOverTimeLine limit={5} onZoom={() => setFocusKey(null)} isFocused />
            )}
            {focusKey === 'types-stacked' && (
              <TypesOverTimeStacked topK={5} onZoom={() => setFocusKey(null)} isFocused />
            )}
          </div>
      )}

      <section className="list-box team-card">
        <h2 className="col-title" style={{ marginBottom: 8 }}>Blue Sky Crisis Post Team</h2>
        <p style={{ margin: 0 }}>
          Designed by: Byron Rodas, Liam George, Corey Jones, Nyha Tortorello, Caden Cochran, San Yun
        </p>
      </section>

      <section className="site-footer">
        <img src={logoUrl} alt="Blue Sky Crisis Intel" className="footer-logo" />
        <div className="footer-mark">Blue Sky Crisis Intel</div>
      </section>
    </div>
  );
}
