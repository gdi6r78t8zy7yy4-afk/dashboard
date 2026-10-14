import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Scatter,
  ScatterChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
} from 'recharts'

interface GasOilComparisonPoint {
  timestamp: string
  value: number
  country?: string
  category?: string
}

interface GasOilComparisonChartProps {
  data: GasOilComparisonPoint[]
  title: string
  unit: string
}

const GasOilComparisonChart = ({ 
  data, 
  title, 
  unit
}: GasOilComparisonChartProps) => {
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    if (!data || data.length === 0) {
      setLoading(false)
      return
    }
    
    try {
      // Process data for scatter chart - format dates and create chart-friendly structure
      const formattedData = data.map(point => ({
        timestamp: point.timestamp,
        value: point.value,
        date: new Date(point.timestamp).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric'
        }),
        country: point.country || 'Unknown',
        category: point.category
      }))
      
      setChartData(formattedData)
      setLoading(false)
    } catch (err) {
      setError('Failed to process comparison data')
      setLoading(false)
    }
  }, [data])
  
  if (loading) {
    return (
      <div className="gas-oil-comparison-chart-loading">
        Loading comparison data...
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="gas-oil-comparison-chart-error">
        {error}
      </div>
    )
  }
  
  if (!data || data.length === 0) {
    return (
      <div className="gas-oil-comparison-chart-empty">
        No comparison data available
      </div>
    )
  }
  
  return (
    <div className="gas-oil-comparison-chart">
      <h3>{title}</h3>
      
      <ResponsiveContainer width="100%" height={250}>
        <ScatterChart margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            type="category" 
            tick={{ fontSize: 10 }}
            name="Date"
          />
          <YAxis 
            dataKey="value" 
            type="number" 
            tick={{ fontSize: 10 }}
            name="Value"
          />
          <ZAxis 
            dataKey="value" 
            range={[10, 100]} 
            name="Value"
          />
          <Tooltip 
            formatter={(value, name) => [Number(value).toLocaleString(), 'Value']}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Legend />
          <Scatter 
            data={chartData} 
            fill="#387c65" 
            name="Comparison"
          />
        </ScatterChart>
      </ResponsiveContainer>
      
      <div className="chart-info">
        <p>Regional comparison data showing {data.length} countries/regions.</p>
      </div>
    </div>
  )
}

export default GasOilComparisonChart