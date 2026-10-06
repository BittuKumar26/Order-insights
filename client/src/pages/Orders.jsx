import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOrders } from '../store/ordersSlice';
import { selectApiFilters } from '../store/filtersSlice';
import FilterBar from '../components/FilterBar';
import { Card, Loading, ErrorState, Empty, Pager } from '../components/ui';
import { money, STATUS_COLORS } from '../format';

export default function Orders() {
  const dispatch = useDispatch();
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const f = useSelector(selectApiFilters);
  const { rows, pagination, loading, error } = useSelector((s) => s.orders);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: 'orderDate', dir: 'desc' });

  useEffect(() => { setPage(1); }, [q, f.from, f.to, f.category, f.status]);
  useEffect(() => {
    const p = dispatch(fetchOrders({ from: f.from, to: f.to, category: f.category, status: f.status, currency: f.currency, q, page, limit: 10, sort: sort.key, dir: sort.dir }));
    return () => p.abort();
  }, [dispatch, f.from, f.to, f.category, f.status, f.currency, q, page, sort]);

  const th = (key, label, cls = '') => (
    <th className={`${cls} sortable`} onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))}>
      {label}{sort.key === key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  );

  return (
    <>
      <h2 className="greet">Orders</h2>
      <FilterBar />
      <Card title="All orders" subtitle={q ? `Matching “${q}”` : 'Server-side paginated'}>
        {error ? <ErrorState message={error} />
          : loading && !rows.length ? <Loading />
          : !rows.length ? <Empty />
          : (
            <div className={`scroll-x ${loading ? 'refreshing' : ''}`}>
              <table className="table">
                <thead><tr>{th('orderId', 'Order')}<th>Customer</th>{th('orderDate', 'Date')}<th>Categories</th><th className="r">Units</th>{th('revenue', 'Total', 'r')}<th>Delivery</th></tr></thead>
                <tbody>{rows.map((o) => (
                  <tr key={o.orderId}>
                    <td><b>#{o.orderId}</b></td><td>{o.customer}</td><td>{o.orderDate || '—'}</td>
                    <td>{o.categories.join(', ')}</td><td className="r">{o.units}</td><td className="r">{money(o.totalValue, f.currency)}</td>
                    <td><span className="pill" style={{ background: `${STATUS_COLORS[o.status]}22`, color: STATUS_COLORS[o.status] }}>{o.status}{o.delayDays > 0 ? ` · ${o.delayDays}d` : ''}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        <Pager page={pagination.page} pages={pagination.pages} total={pagination.total} onChange={setPage} />
      </Card>
    </>
  );
}
