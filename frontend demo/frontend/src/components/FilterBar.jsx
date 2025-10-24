import { useMemo } from 'react';

export default function FilterBar({ types = [], values = [], onToggle, onClearAll }) {
  const uniq = useMemo(() => {
    return Array.from(new Set(types.filter(Boolean))).sort((a,b) => a.localeCompare(b));
  }, [types]);

  const isActive = (t) => values.includes(String(t || ''));

  const clearAll = () => {
    if (typeof onClearAll === 'function') onClearAll();
  };

  return (
    <div className="filter-types-inline">
    <div className="filter-label">Disaster Types:</div>

    <div className="type-chip-row" role="group" aria-label="Filter by type">
      <button
        className={`chip ${values.length === 0 ? 'active' : ''}`}
        onClick={clearAll}
        aria-pressed={values.length === 0}
        title="Show all types"
      >
        All
      </button>

      {uniq.map((t) => (
        <button
          key={t}
          className={`chip ${isActive(t) ? 'active' : ''}`}
          onClick={() => onToggle?.(t)}
          aria-pressed={isActive(t)}
        >
          {t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()}
        </button>
      ))}

      {values.length > 0 && (
        <button className="chip" onClick={clearAll} title="Clear all">
          Clear Filters
        </button>
      )}
    </div>
    </div>
  );
}