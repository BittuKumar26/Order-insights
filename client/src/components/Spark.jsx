import { ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area } from 'recharts';

// Tiny chart for KPI cards. type: 'line' | 'bar' | 'dots' | 'area'
export default function Spark({ type = 'line', data = [], color = '#6366f1', id = 'sp' }) {
  const rows = data.map((v) => ({ v }));
  const common = { data: rows, margin: { top: 6, right: 4, bottom: 4, left: 4 } };
  return (
    <div className="pz-spark" aria-hidden="true">
      <ResponsiveContainer width="100%" height={72}>
        {type === 'bar' ? (
          <BarChart {...common}><Bar dataKey="v" fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} /></BarChart>
        ) : type === 'area' ? (
          <AreaChart {...common}>
            <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.3} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} isAnimationActive={false} />
          </AreaChart>
        ) : (
          <LineChart {...common}><Line type="monotone" dataKey="v" stroke={color} strokeWidth={2.2} dot={type === 'dots' ? { r: 3, fill: '#fff', stroke: color, strokeWidth: 2 } : false} isAnimationActive={false} /></LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
