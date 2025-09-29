export default function FilterBar({ onApply }) {
  function handleSubmit(e) {
    e.preventDefault();
    onApply?.(); // close the sidebar on Apply
  }

  return (
    <form className="filterbar" onSubmit={handleSubmit}>
      <div className="filterbar-group">
        <label>Type of disaster</label>
        <select className="input" defaultValue="">
          <option value="">Any</option>
          <option value="Tornado">Tornado</option>
          <option value="Flood">Flood</option>
          <option value="Earthquake">Earthquake</option>
          <option value="Thunderstorm">Thunderstorm</option>
        </select>
      </div>

      <div className="filterbar-group">
        <label>Location</label>
        <input className="input" placeholder="City, State or Region" />
      </div>

      <button type="submit" className="btn">Apply</button>
    </form>
  );
}