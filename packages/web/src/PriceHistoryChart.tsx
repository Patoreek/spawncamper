import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PriceHistoryPoint } from './types'

interface Series {
  product_url_id: number
  retailer: string
  data: Array<{ t: number; price_aud: number; price: number; currency: string }>
}

// Distinct, reasonably colourblind-friendly palette. Cycled if more series than colours.
const PALETTE = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#ca8a04']

const formatDateShort = (t: number): string =>
  new Date(t).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

const formatDateFull = (t: number): string =>
  new Date(t).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export function PriceHistoryChart({ history }: { history: PriceHistoryPoint[] }) {
  // Group into one series per URL. Skip points without AUD conversion — they
  // can't be plotted on the shared (AUD) Y-axis.
  const byUrl = new Map<number, Series>()
  for (const p of history) {
    if (p.price_aud === null) continue
    let s = byUrl.get(p.product_url_id)
    if (!s) {
      s = { product_url_id: p.product_url_id, retailer: p.retailer, data: [] }
      byUrl.set(p.product_url_id, s)
    }
    s.data.push({
      t: new Date(p.created_at).getTime(),
      price_aud: p.price_aud,
      price: p.price,
      currency: p.currency,
    })
  }
  const series = Array.from(byUrl.values())

  if (series.length === 0 || series.every((s) => s.data.length === 0)) {
    return <p className="empty-history">No price history yet — run a check first.</p>
  }

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatDateShort}
            stroke="#6b7280"
            fontSize={12}
          />
          <YAxis
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            stroke="#6b7280"
            fontSize={12}
            width={48}
          />
          <Tooltip
            labelFormatter={(t) => formatDateFull(Number(t))}
            formatter={(value: number, name: string, item) => {
              // item.payload holds the original point — surface native price too.
              const payload = (item as { payload?: { price: number; currency: string } }).payload
              const native = payload ? ` (${payload.currency} ${payload.price.toFixed(2)})` : ''
              return [`$${value.toFixed(2)}${native}`, name]
            }}
          />
          <Legend />
          {series.map((s, i) => (
            <Line
              key={s.product_url_id}
              data={s.data}
              dataKey="price_aud"
              name={s.retailer}
              stroke={PALETTE[i % PALETTE.length]}
              type="monotone"
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
