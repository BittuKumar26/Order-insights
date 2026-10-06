import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ShoppingBag, Wallet, Truck, TrendingUp, X } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell, PieChart, Pie, Legend } from 'recharts';
import { fetchSummary, fetchDrill } from '../store/dashboardSlice';
import { selectApiFilters, setFilter } from '../store/filtersSlice';
import FilterBar from '../components/FilterBar';
import { Card, KpiCard, Loading, ErrorState, Empty, Toggle } from '../components/ui';
import { money, compact, num, periodLabel, STATUS_COLORS } from '../format';

const PALETTE = ['#2065d1', '#1890ff', '#ffc107', '#ff4842', '#7a4fff', '#22c55e'];

export default function Dashboard() {
  const dispatch = useDispatch();
  const api = useSelector(selectApiFilters);
  const { metric, drillCategory, currency } = useSelector((s) => s.filters);
  const { summary, loading, error, drill, drillLoading, drillError } = useSelector((s) => s.dashboard);

  // refetch whenever any API-facing filter changes; abort the superseded request
  useEffect(() => {
    const p = dispatch(fetchSummary(api));
    return () => p.abort();
  }, [dispatch, api.from, api.to, api.category, api.status, api.currency, api.granularity]); // eslint-disable-line

  useEffect(() => {
    if (!drillCategory) return undefined;
    const p = dispatch(fetchDrill({ category: drillCategory, params: { from: api.from, to: api.to, status: api.status, currency: api.currency } }));
    return () => p.abort();
  }, [dispatch, drillCategory, api.from, api.to, api.status, api.currency]); // eslint-disable-line

  const k = summary?.kpis;
  const isRev = metric === 'revenue';
  const fmt = (v) => (isRev ? money(v, currency) : num(v));

  return (
    <>
      <h2 className="greet">Hi, Welcome back 👋</h2>
      <FilterBar />
      {error ? <ErrorState message={error} onRetry={() => dispatch(fetchSummary(api))} />
        : !summary ? <Loading label="Loading dashboard…" />
        : (
          <div className={loading ? 'refreshing' : ''}>
            <div className="kpi-grid">
              <KpiCard tone="blue" icon={ShoppingBag} value={num(k.totalOrders)} label="Total Orders" />
              <KpiCard tone="cyan" icon={Wallet} value={compact(k.totalRevenue, currency)} label="Total Revenue" hint={`Avg order ${money(k.avgOrderValue, currency)}`} />
              <KpiCard tone="red" icon={Truck} value={num(k.delayedOrders)} label="Delayed Orders" hint={`${k.delayRate}% of orders · avg ${k.avgDelayDays}d late`} />
              <KpiCard tone="yellow" icon={TrendingUp} value={`${(100 - k.delayRate).toFixed(1)}%`} label="On-time Rate" />
            </div>

            {!summary.trend.length ? <Card><Empty /></Card> : (
              <div className="grid-2">
                <Card
                  title={isRev ? 'Revenue Trend' : 'Orders Trend'}
                  subtitle={`${isRev ? 'Revenue' : 'Order count'} per ${api.granularity}`}
                  action={
                    <div className="row">
                      <Toggle value={metric} onChange={(v) => dispatch(setFilter({ metric: v }))} options={[{ value: 'revenue', label: 'Revenue' }, { value: 'orders', label: 'Orders' }]} />
                      <Toggle value={api.granularity} onChange={(v) => dispatch(setFilter({ granularity: v }))} options={[{ value: 'month', label: 'Monthly' }, { value: 'day', label: 'Daily' }]} />
                    </div>
                  }
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={summary.trend}>
                      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1890ff" stopOpacity={0.25} /><stop offset="100%" stopColor="#1890ff" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="period" tickFormatter={periodLabel} fontSize={12} minTickGap={24} />
                      <YAxis tickFormatter={(v) => (isRev ? compact(v, currency) : v)} fontSize={12} width={64} />
                      <Tooltip labelFormatter={periodLabel} formatter={(v) => [fmt(v), isRev ? 'Revenue' : 'Orders']} />
                      <Area type="monotone" dataKey={metric} fill="url(#g)" stroke="none" />
                      <Line type="monotone" dataKey={metric} stroke="#1890ff" strokeWidth={2.5} dot={summary.trend.length < 40} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>

                <Card title="Delivery Performance" subtitle="Click a slice to filter by status">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={summary.delivery} dataKey="orders" nameKey="status" outerRadius={100} label={({ percent }) => `${(percent * 100).toFixed(1)}%`} onClick={(d) => dispatch(setFilter({ status: api.status === d.status ? '' : d.status }))} style={{ cursor: 'pointer' }}>
                        {summary.delivery.map((d) => <Cell key={d.status} fill={STATUS_COLORS[d.status]} stroke={api.status === d.status ? '#212b36' : '#fff'} strokeWidth={api.status === d.status ? 3 : 2} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [`${v} orders`, n]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}

            {summary.byCategory.length > 0 && (
              <div className="grid-2">
              <Card title={isRev ? 'Category-wise Revenue' : 'Category-wise Orders'} subtitle="Click a bar to drill down into its products">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={summary.byCategory} onClick={(e) => e?.activeLabel && dispatch(setFilter({ drillCategory: e.activeLabel }))} style={{ cursor: 'pointer' }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="category" fontSize={12} />
                    <YAxis tickFormatter={(v) => (isRev ? compact(v, currency) : v)} fontSize={12} width={64} />
                    <Tooltip formatter={(v) => [fmt(v), isRev ? 'Revenue' : 'Orders']} />
                    <Bar dataKey={isRev ? 'revenue' : 'orders'} radius={[6, 6, 0, 0]} maxBarSize={56}>
                      {summary.byCategory.map((c, i) => <Cell key={c.category} fill={PALETTE[i % PALETTE.length]} opacity={!drillCategory || drillCategory === c.category ? 1 : 0.35} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            
                <Card title="Top Customers" subtitle="By revenue">
                  <ol className="rank">
                    {summary.topCustomers.map((c, i) => (
                      <li key={c.customer}><span className="muted">{i + 1}</span><b>{c.customer}</b><span className="muted">{c.orders} orders</span><span className="amt">{money(c.revenue, currency)}</span></li>
                    ))}
                  </ol>
                </Card>
              </div>
            )}

            {drillCategory && (
              <Card
                title={`Drill-down: ${drillCategory}`}
                subtitle="Product breakdown within the current filters"
                action={<button className="icon-btn" onClick={() => dispatch(setFilter({ drillCategory: '' }))} aria-label="Close drill-down"><X size={18} /></button>}
              >
                {drillError ? <ErrorState message={drillError} />
                  : drillLoading || !drill ? <Loading />
                  : (
                    <>
                      <table className="table">
                        <thead><tr><th>Product</th><th className="r">Units</th><th className="r">Orders</th><th className="r">Revenue</th></tr></thead>
                        <tbody>{drill.products.map((p) => (
                          <tr key={p.productId}><td>{p.name} <span className="muted">{p.productId}</span></td><td className="r">{num(p.units)}</td><td className="r">{num(p.orders)}</td><td className="r">{money(p.revenue, currency)}</td></tr>
                        ))}</tbody>
                      </table>
                      <p><Link to="/orders" onClick={() => dispatch(setFilter({ category: drillCategory }))}>View {drillCategory} orders →</Link></p>
                    </>
                  )}
              </Card>
            )}
          </div>
        )}
    </>
  );
}
