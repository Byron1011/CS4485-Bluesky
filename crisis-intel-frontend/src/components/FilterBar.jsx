import { useRef } from 'react';

export default function FilterBar({ onApply, onClear }) {
  const formRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const values = {
      type: fd.get('type') || '',
      location: (fd.get('location') || '').trim(),
      timeWindowHours: fd.get('timeWindowHours') || ''
    };
    onApply?.(values); // parent applies + closes
  }

  //clear filter values
  function handleClear() {
    // Reset the UI fields
    if (formRef.current) {
      formRef.current.reset();
  
      formRef.current.type.value = '';
      formRef.current.location.value = '';
      formRef.current.timeWindowHours.value = '';
    }

    onApply?.({ type: '', location: '', timeWindowHours: '' });
    onClear?.();
  }

  return (
    <form ref={formRef} className="filterbar" onSubmit={handleSubmit}>
      <div className="filterbar-group">
        <label htmlFor="type">Type of disaster</label>
        <select id="type" name="type" className="input" defaultValue="">
          <option value="">Any</option>
          <option value="Tornado">Tornado</option>
          <option value="Flood">Flood</option>
          <option value="Earthquake">Earthquake</option>
          <option value="Thunderstorm">Thunderstorm</option>
        </select>
      </div>

      <div className="filterbar-group">
        <label htmlFor="location">Location</label>
        <input id="location" name="location" className="input" placeholder="City, State or Region" />
      </div>

      <div className="filterbar-group">
        <label htmlFor="timeWindowHours">Time window</label>
        <select id="timeWindowHours" name="timeWindowHours" className="input" defaultValue="">
          <option value="">Any time</option>
          <option value="24">Past 24 hours</option>
          <option value="48">Past 48 hours</option>
          <option value="72">Past 72 hours</option>
        </select>
      </div>

      <div className="filterbar-group" style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn">Apply</button>
        <button type="button" className="btn" onClick={handleClear}>Clear filters</button>
      </div>
    </form>
  );
}