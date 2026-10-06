import { useSelector } from 'react-redux';
import { useFetch } from '../hooks/useFetch';
import { Card, Loading, ErrorState, Empty } from '../components/ui';
import { money, num } from '../format';

export default function Products() {
  const { data, loading, error, retry } = useFetch('/products');
  const currency = useSelector((s) => s.filters.currency);
  return (
    <>
      <h2 className="greet">Products</h2>
      <Card title="Product catalog" subtitle="Revenue shown in INR (base currency)">
        {error ? <ErrorState message={error} onRetry={retry} /> : loading ? <Loading /> : !data?.length ? <Empty>No products yet. Load data from the Data Ingest page.</Empty> : (
          <div className="scroll-x"><table className="table">
            <thead><tr><th>ID</th><th>Name</th><th>Category</th><th className="r">Units sold</th><th className="r">Revenue (INR)</th></tr></thead>
            <tbody>{data.map((p) => (
              <tr key={p.productId}><td>{p.productId}</td><td>{p.name}</td><td>{p.category}</td><td className="r">{num(p.units)}</td><td className="r">{money(p.revenue, 'INR')}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </>
  );
}
