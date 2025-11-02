import { useId } from 'react';

export default function DateRangePicker({
  from = '',
  to = '',
  onChange,
  onClear,
}) {
  const fromId = useId();
  const toId = useId();

  const setFrom = (v) => onChange?.({ from: v, to });
  const setTo = (v) => onChange?.({ from, to: v });

  return (
    <div className="date-row" role="group" aria-label="Filter by date range">
      <div className="date-field">
        <label htmlFor={fromId}>From</label>
        <input
          id={fromId}
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </div>

      <div className="date-field">
        <label htmlFor={toId}>To</label>
        <input
          id={toId}
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          min={from || undefined}
        />
      </div>

      {(from || to) ? (
        <button type="button" className="chip" onClick={() => onClear?.()}>
          Clear dates
        </button>
      ) : null}
    </div>
  );
}