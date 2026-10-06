import { useDispatch, useSelector } from 'react-redux';
import { setFilter, clearFilters } from '../store/filtersSlice';

export default function FilterBar() {
  const dispatch = useDispatch();
  const f = useSelector((s) => s.filters);
  const opts = useSelector((s) => s.dashboard.options);
  const set = (k) => (e) => dispatch(setFilter({ [k]: e.target.value, drillCategory: k === 'category' ? '' : f.drillCategory }));
  const dirty = f.from || f.to || f.category || f.status;
  return (
    <div className="filters">
      <label>From<input type="date" value={f.from} min={opts?.dateRange.min || ''} max={f.to || opts?.dateRange.max || ''} onChange={set('from')} /></label>
      <label>To<input type="date" value={f.to} min={f.from || opts?.dateRange.min || ''} max={opts?.dateRange.max || ''} onChange={set('to')} /></label>
      <label>Category
        <select value={f.category} onChange={set('category')}>
          <option value="">All categories</option>
          {opts?.categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label>Delivery status
        <select value={f.status} onChange={set('status')}>
          <option value="">All statuses</option>
          {opts?.statuses.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      {dirty && <button className="btn ghost" onClick={() => dispatch(clearFilters())}>Clear</button>}
    </div>
  );
}
