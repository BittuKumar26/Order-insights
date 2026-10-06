import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { Card, Loading, ErrorState, Empty, Pager } from '../components/ui';
import { num } from '../format';

const REGIONS = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania', 'Antarctic'];

// Data from the REST Countries API (via our backend, which flattens & caches it).
export default function Countries() {
  const [f, setF] = useState({ q: '', region: '', minPop: '', maxPop: '', page: 1 });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value, page: 1 }));
  const { data, meta, loading, error, retry } = useFetch('/meta/countries', { ...f, limit: 15 });
  return (
    <>
      <h2 className="greet">Countries &amp; Currencies</h2>
      <div className="filters">
        <label>Search<input value={f.q} onChange={set('q')} placeholder="Country name" /></label>
        <label>Region<select value={f.region} onChange={set('region')}><option value="">All</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label>Min population<input type="number" min="0" value={f.minPop} onChange={set('minPop')} /></label>
        <label>Max population<input type="number" min="0" value={f.maxPop} onChange={set('maxPop')} /></label>
      </div>
      <Card title="Country → currency → population" subtitle="Source: restcountries.com">
        {error ? <ErrorState message={error} onRetry={retry} /> : loading && !data ? <Loading /> : !data?.length ? <Empty /> : (
          <>
            <div className={`scroll-x ${loading ? 'refreshing' : ''}`}><table className="table">
              <thead><tr><th>Country</th><th>Region</th><th>Currencies</th><th className="r">Population</th><th className="r">Density /km²</th></tr></thead>
              <tbody>{data.map((c) => (
                <tr key={c.code || c.name}><td><b>{c.name}</b></td><td>{c.region}</td><td>{c.currencies.map((x) => `${x.code}${x.symbol ? ` (${x.symbol})` : ''}`).join(', ') || '—'}</td><td className="r">{num(c.population)}</td><td className="r">{c.density ?? '—'}</td></tr>
              ))}</tbody>
            </table></div>
            <Pager page={meta.pagination.page} pages={meta.pagination.pages} total={meta.pagination.total} onChange={(p) => setF((s) => ({ ...s, page: p }))} />
          </>
        )}
      </Card>
    </>
  );
}
