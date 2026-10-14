import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface GasOilSupplyPoint {
  timestamp: string
  value: number
  category?: string
  country?: string
}

interface GasOilSupplyDataset {
  status: 'ok' | 'not_configured' | 'error' | 'missing' | 'stale'
  dataType: string
  unit: string
  points: GasOilSupplyPoint[]
  lastUpdated: string | null
  note: string | null
}

interface GasOilSupplyChartProps {
  data: GasOilSupplyPoint[]
  indicator: string
  unit: string
  timePeriod: string
  onPointSelect?: (point: GasOilSupplyPoint) => void
}

const GasOilSupplyChart = ({ 
  data, 
  indicator, 
  unit, 
  timePeriod,
  onPointSelect
}: GasOilSupplyChartProps) => {
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
        }),
        country: point.country
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
      <div className="gas-oil-supply-chart-loading">
        Loading chart data...
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="gas-oil-supply-chart-error">
        {error}
      </div>
    )
  }
  
  if (!data || data.length === 0) {
    return (
      <div className="gas-oil-supply-chart-empty">
        No data available for {indicator}
      </div>
    )
  }
  
  // Get latest value
  const latestPoint = data[data.length - 1]
  const firstPoint = data[0]
  
  return (
    <div className="gas-oil-supply-chart">
      <div className="chart-header">
        <h3>{indicator.charAt(0).toUpperCase() + indicator.slice(1)} Supply</h3>
        <div className="supply-summary">
          <span className="current-value">
            {latestPoint.value.toLocaleString()} {unit}
          </span>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 10 }} 
          />
          <YAxis 
            domain={['auto', 'auto']} 
            tick={{ fontSize: 10 }}
          />
          <Tooltip 
            formatter={(value, name) => [Number(value).toLocaleString(), 'Value']}
            labelFormatter={(label) => `Time: ${label}`}
          />
          <Legend />
          <Bar 
            dataKey="value" 
            fill="#387c65" 
            name={indicator}
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
        </BarChart>
      </ResponsiveContainer>
      
      <div className="chart-stats">
        <div className="stat-item">
          <span>Min:</span>
          <strong>{stats?.min.toLocaleString() || 'N/A'} {unit}</strong>
        </div>
        <div className="stat-item">
          <span>Max:</span>
          <strong>{stats?.max.toLocaleString() || 'N/A'} {unit}</strong>
        </div>
        <div className="stat-item">
          <span>Avg:</span>
          <strong>{stats?.avg.toFixed(2) || 'N/A'} {unit}</strong>
        </div>
      </div>
      
      <div className="chart-info">
        <p>Supply data sourced from EIA and national statistics. Data refreshed every 24 hours.</p>
      </div>
    </div>
  )
}

export default GasOilSupplyChart