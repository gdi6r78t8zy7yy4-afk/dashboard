import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine
} from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface GasOilPricePoint {
  timestamp: string
  value: number
  benchmark?: string
}

interface GasOilPriceDataset {
  status: 'ok' | 'not_configured' | 'error' | 'missing' | 'stale'
  dataType: string
  unit: string
  points: GasOilPricePoint[]
  lastUpdated: string | null
  note: string | null
}

interface GasOilPriceChartProps {
  data: GasOilPricePoint[]
  benchmark: string
  unit: string
  timePeriod: string
  onPointSelect?: (point: GasOilPricePoint) => void
}

const GasOilPriceChart = ({ 
  data, 
  benchmark, 
  unit, 
  timePeriod,
  onPointSelect
}: GasOilPriceChartProps) => {
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    if (!data || data.length === 0) {
      setLoading(false)
      return
    }
    
    try {
      // Process data for charting - format dates and create chart-friendly structure
      const formattedData = data.map(point => ({
        timestamp: point.timestamp,
        value: point.value,
        date: new Date(point.timestamp).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        time: new Date(point.timestamp).toLocaleTimeString('en-US', { 
          hour: '2-digit',
          minute: '2-digit'
        })
      }))
      
      setChartData(formattedData)
      setLoading(false)
    } catch (err) {
      setError('Failed to process chart data')
      setLoading(false)
    }
  }, [data])
  
  // Calculate statistics
  const calculateStats = () => {
    if (!data || data.length < 2) return null
    
    const values = data.map(d => d.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length
    
    // Calculate change from first to last
    const first = data[0].value
    const last = data[data.length - 1].value
    const change = last - first
    const changePercent = first !== 0 ? (change / first) * 100 : 0
    
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg,
      change,
      changePercent
    }
  }
  
  const stats = calculateStats()
  
  if (loading) {
    return (
      <div className="gas-oil-price-chart-loading">
        Loading chart data...
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="gas-oil-price-chart-error">
        {error}
      </div>
    )
  }
  
  if (!data || data.length === 0) {
    return (
      <div className="gas-oil-price-chart-empty">
        No data available for {benchmark}
      </div>
    )
  }
  
  // Get latest value
  const latestPoint = data[data.length - 1]
  const firstPoint = data[0]
  
  return (
    <div className="gas-oil-price-chart">
      <div className="chart-header">
        <h3>{benchmark} Price</h3>
        <div className="price-summary">
          <span className="current-price">
            {latestPoint.value.toFixed(2)} {unit}
          </span>
          {stats && (
            <span className={`price-change ${stats.change >= 0 ? 'positive' : 'negative'}`}>
              {stats.change >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {stats.changePercent.toFixed(2)}% ({stats.change >= 0 ? '+' : ''}{stats.change.toFixed(2)})
            </span>
          )}
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 10 }} 
          />
          <YAxis 
            domain={['auto', 'auto']} 
            tick={{ fontSize: 10 }}
            tickFormatter={(value) => value.toFixed(2)}
          />
          <Tooltip 
            formatter={(value, name) => [Number(value).toFixed(2), 'Price']}
            labelFormatter={(label) => `Time: ${label}`}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#387c65" 
            strokeWidth={2} 
            dot={{ r: 4 }} 
            activeDot={{ r: 6 }} 
            name={benchmark}
            onClick={(data) => {
              if (onPointSelect && data.payload) {
                const point = data.payload
                // Find the original point by timestamp
                const originalPoint = data.find((p: any) => p.timestamp === point.timestamp)
                if (originalPoint) {
                  onPointSelect(originalPoint)
                }
              }
            }}
          />
          {stats && (
            <ReferenceLine 
              y={stats.avg} 
              stroke="#899188" 
              strokeDasharray="3 3" 
              strokeWidth={1}
              label={{ value: `Avg: ${stats.avg.toFixed(2)}`, position: 'right', offset: 10 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      
      <div className="chart-stats">
        <div className="stat-item">
          <span>Min:</span>
          <strong>{stats?.min.toFixed(2) || 'N/A'} {unit}</strong>
        </div>
        <div className="stat-item">
          <span>Max:</span>
          <strong>{stats?.max.toFixed(2) || 'N/A'} {unit}</strong>
        </div>
        <div className="stat-item">
          <span>Avg:</span>
          <strong>{stats?.avg.toFixed(2) || 'N/A'} {unit}</strong>
        </div>
      </div>
      
      <div className="chart-info">
        <p>Price data sourced from EIA and commodity exchanges. Data refreshed every 15 minutes.</p>
      </div>
    </div>
  )
}

export default GasOilPriceChart