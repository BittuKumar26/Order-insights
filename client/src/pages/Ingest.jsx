import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { api } from '../api/client';
import { fetchMeta } from '../store/dashboardSlice';
import { Card, Loading, ErrorState } from '../components/ui';

const SOURCES = [
  { path: '/ingest/json', title: 'Orders (JSON)', accept: '.json', hint: 'Nested orders with items' },
  { path: '/ingest/xml', title: 'Shipments (XML)', accept: '.xml', hint: '<shipment> records' },
  { path: '/ingest/csv', title: 'Products (CSV)', accept: '.csv', hint: 'ProductID, ProductName, Category' },
];

export default function Ingest() {
  const dispatch = useDispatch();
  const [state, setState] = useState({ busy: false, error: null, results: null });

  // Large uploads are queued server-side (?async=true); poll the job until it finishes.
  const waitForJob = async (r) => {
    if (!r.data?.jobId) return r;
    for (let i = 0; i < 120; i++) {
      await new Promise((res) => setTimeout(res, 500));
      const { data: job } = await api.get(`/ingest/jobs/${r.data.jobId}`);
      if (job.status === 'done') return { data: job.result };
      if (job.status === 'failed') throw new Error(job.error || 'Ingest job failed');
    }
    throw new Error('Ingest is taking too long; check again shortly.');
  };

  const run = async (fn) => {
    setState({ busy: true, error: null, results: null });
    try {
      const r = await waitForJob(await fn());
      setState({ busy: false, error: null, results: Array.isArray(r.data) ? r.data : [r.data] });
      dispatch(fetchMeta());
    } catch (e) { setState({ busy: false, error: e.message, results: null }); }
  };

  return (
    <>
      <h2 className="greet">Data Ingest</h2>
      <Card title="Quick start" subtitle="Loads the exercise files plus extra generated demo orders and shipments">
        <div className="row">
          <button className="btn primary" disabled={state.busy} onClick={() => run(() => api.post('/ingest/samples?async=true'))}>Load sample data</button>
          <button className="btn" disabled={state.busy} onClick={() => window.confirm('Delete all data?') && run(async () => { await api.del('/ingest/reset'); return { data: [] }; })}>Reset database</button>
        </div>
      </Card>
      <div className="kpi-grid three">
        {SOURCES.map((s) => (
          <Card key={s.path} title={s.title} subtitle={`${s.hint} · replaces your previous ${s.title.split(' ')[0].toLowerCase()} dataset`}>
            <input type="file" accept={s.accept} disabled={state.busy} onChange={(e) => { const file = e.target.files[0]; if (file) run(() => api.upload(`${s.path}?async=true`, file)); e.target.value = ''; }} />
          </Card>
        ))}
      </div>
      {state.busy && <Loading label="Processing…" />}
      {state.error && <ErrorState message={state.error} />}
      {state.results && (
        <Card title="Result">
          {!state.results.length ? <p>Database cleared.</p> : state.results.map((r, i) => (
            <div key={i} className="result">
              <b>{r.file || r.dataset}</b>: {r.received} records · {r.inserted} new · {r.updated} updated · {r.skippedOrWarned} data warnings
              {r.issues?.length > 0 && <details><summary>Show warnings</summary><ul>{r.issues.map((x, j) => <li key={j}>{x}</li>)}</ul></details>}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
