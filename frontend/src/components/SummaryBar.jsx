export default function SummaryBar({ summaryText, results, total }) {
  return (
    <div
      className="filter-summary"
      role="status"
      aria-live="polite"
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
    >
      <div className="filter-summary-left">
        {summaryText}
      </div>
      <div className="filter-summary-right">
        Results: {results} / {total}
      </div>
    </div>
  );
}