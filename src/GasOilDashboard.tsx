import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Activity, Gauge, AlertTriangle, CheckCircle, Calendar, Filter, Download } from 'lucide-react'
import GasOilMap from './components/GasOilMap'
import GasOilDetailPanel from './components/GasOilDetailPanel'
import GasOilPriceChart from './components/GasOilPriceChart'
import GasOilSupplyChart from './components/GasOilSupplyChart'
import GasOilComparisonChart from './components/GasOilComparisonChart'

// Define types for our gas oil dashboard
type GasOilPoint = { 
  timestamp: string; 
  value: number; 
  category?: string | null; 
  quality?: string | null;
  country?: string;
}

type GasOilDataset = { 
  status: 'ok' | 'not_configured' | 'error' | 'missing' | 'stale';
  dataType: string;
  unit: string;
  points: GasOilPoint[];
  lastUpdated: string | null;
  note: string | null;
}

type GasOilFeature = {
  id: string;
  name: string;
  type: 'country' | 'field' | 'terminal' | 'pipeline' | 'storage' | 'coordinates';
  commodity?: string;
  indicator?: string;
  value?: number;
  unit?: string;
  coordinates?: [number, number];
  country?: string;
  source?: string;
  lastUpdated?: string;
  status?: 'ok' | 'stale' | 'error' | 'missing';
  note?: string;
}

// Mock data for demonstration purposes
const MOCK_GAS_OIL_DATA = {
  // Production data (mock)
  production: {
    'United States': { 
      points: [
        { timestamp: '2026-10-10T00:00:00Z', value: 12000, category: 'production', country: 'United States' },
        { timestamp: '2026-10-10T01:00:00Z', value: 12100, category: 'production', country: 'United States' },
        { timestamp: '2026-10-10T02:00:00Z', value: 11900, category: 'production', country: 'United States' },
        { timestamp: '2026-10-10T03:00:00Z', value: 12200, category: 'production', country: 'United States' },
        { timestamp: '2026-10-10T04:00:00Z', value: 12300, category: 'production', country: 'United States' },
      ],
      unit: 'barrels/day',
      status: 'ok'
    },
    'Saudi Arabia': { 
      points: [
        { timestamp: '2026-10-10T00:00:00Z', value: 10000, category: 'production', country: 'Saudi Arabia' },
        { timestamp: '2026-10-10T01:00:00Z', value: 10200, category: 'production', country: 'Saudi Arabia' },
        { timestamp: '2026-10-10T02:00:00Z', value: 9800, category: 'production', country: 'Saudi Arabia' },
        { timestamp: '2026-10-10T03:00:00Z', value: 10100, category: 'production', country: 'Saudi Arabia' },
        { timestamp: '2026-10-10T04:00:00Z', value: 9900, category: 'production', country: 'Saudi Arabia' },
      ],
      unit: 'barrels/day',
      status: 'ok'
    }
  },
  
  // Prices data (mock)
  prices: {
    'Brent Crude': { 
      points: [
        { timestamp: '2026-10-10T00:00:00Z', value: 75.20 },
        { timestamp: '2026-10-10T01:00:00Z', value: 75.80 },
        { timestamp: '2026-10-10T02:00:00Z', value: 74.90 },
        { timestamp: '2026-10-10T03:00:00Z', value: 76.10 },
        { timestamp: '2026-10-10T04:00:00Z', value: 75.50 },
      ],
      unit: 'USD/barrel',
      status: 'ok'
    },
    'WTI Crude': { 
      points: [
        { timestamp: '2026-10-10T00:00:00Z', value: 72.40 },
        { timestamp: '2026-10-10T01:00:00Z', value: 73.10 },
        { timestamp: '2026-10-10T02:00:00Z', value: 71.80 },
        { timestamp: '2026-10-10T03:00:00Z', value: 73.50 },
        { timestamp: '2026-10-10T04:00:00Z', value: 72.90 },
      ],
      unit: 'USD/barrel',
      status: 'ok'
    }
  }
}

const GasOilDashboard = () => {
  const [commodity, setCommodity] = useState('crude_oil')
  const [indicator, setIndicator] = useState('production')
  const [selectedFeature, setSelectedFeature] = useState<GasOilFeature | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timePeriod, setTimePeriod] = useState('24h')
  const [selectedCommodity, setSelectedCommodity] = useState('crude_oil')
  const [selectedIndicator, setSelectedIndicator] = useState('production')
  const [selectedBenchmark, setSelectedBenchmark] = useState('Brent Crude')
  
  // Mock data state
  const [priceData, setPriceData] = useState<GasOilPoint[]>([])
  const [supplyData, setSupplyData] = useState<GasOilPoint[]>([])
  const [comparisonData, setComparisonData] = useState<GasOilPoint[]>([])
  
  // Simulate fetching data from API
  useEffect(() => {
    setLoading(true)
    setError(null)
    
    const fetchData = async () => {
      try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Load appropriate data based on indicator
        if (indicator === 'prices') {
          const benchmarkData = MOCK_GAS_OIL_DATA.prices[selectedBenchmark] || MOCK_GAS_OIL_DATA.prices['Brent Crude']
          if (benchmarkData && benchmarkData.points) {
            setPriceData(benchmarkData.points)
          }
        } else {
          // For other indicators, use production data
          const countryData = MOCK_GAS_OIL_DATA.production || {}
          const countries = Object.keys(countryData)
          if (countries.length > 0) {
            // Create sample data with different values for demonstration
            const sampleData = []
            for (let i = 0; i < 24; i++) {
              const timestamp = new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString()
              sampleData.push({
                timestamp,
                value: 10000 + Math.floor(Math.random() * 2000) - 1000,
                country: countries[Math.floor(Math.random() * countries.length)],
                category: indicator
              })
            }
            setSupplyData(sampleData)
          }
        }
        
        // Set comparison data (mocked for demonstration)
        const comparisonPoints = []
        const countries = ['United States', 'Saudi Arabia', 'Russia', 'China', 'Canada']
        for (let i = 0; i < 12; i++) {
          const timestamp = new Date(Date.now() - (11 - i) * 24 * 60 * 60 * 1000).toISOString()
          comparisonPoints.push({
            timestamp,
            value: 8000 + Math.floor(Math.random() * 4000) - 2000,
            country: countries[Math.floor(Math.random() * countries.length)],
            category: 'production'
          })
        }
        setComparisonData(comparisonPoints)
        
        setLoading(false)
      } catch (err) {
        setError('Failed to load gas and oil data')
        setLoading(false)
      }
    }
    
    fetchData()
  }, [commodity, indicator, selectedBenchmark])
  
  // Handle feature selection from map
  const handleFeatureSelect = (feature: GasOilFeature) => {
    setSelectedFeature(feature)
  }
  
  // Handle viewing history
  const handleShowHistory = (feature: GasOilFeature) => {
    setShowHistory(true)
    setSelectedFeature(feature)
  }
  
  // Close detail panel
  const handleCloseDetail = () => {
    setSelectedFeature(null)
    setShowHistory(false)
  }
  
  // Format timestamp for display
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }
  
  // Render loading state
  if (loading) {
    return (
      <div className="gas-oil-dashboard" aria-label="Gas and Oil Dashboard">
        <div className="dashboard-loading">Loading gas and oil data...</div>
      </div>
    )
  }
  
  // Render error state
  if (error) {
    return (
      <div className="gas-oil-dashboard" aria-label="Gas and Oil Dashboard">
        <div className="dashboard-error">{error}</div>
      </div>
    )
  }
  
  return (
    <div className="gas-oil-dashboard" aria-label="Gas and Oil Dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Global Gas & Oil Dashboard</h1>
          <p>Real-time monitoring of global oil and natural gas production, storage, transportation and markets</p>
        </div>
        <div className="dashboard-controls">
          <label htmlFor="commodity-select">Commodity:</label>
          <select 
            id="commodity-select"
            value={commodity}
            onChange={(e) => setCommodity(e.target.value)}
          >
            <option value="crude_oil">Crude Oil</option>
            <option value="natural_gas">Natural Gas</option>
            <option value="refined_products">Refined Products</option>
            <option value="lng">LNG</option>
          </select>
          
          <label htmlFor="indicator-select">Indicator:</label>
          <select 
            id="indicator-select"
            value={indicator}
            onChange={(e) => setIndicator(e.target.value)}
          >
            <option value="production">Production</option>
            <option value="consumption">Consumption</option>
            <option value="reserves">Reserves</option>
            <option value="imports">Imports</option>
            <option value="exports">Exports</option>
            <option value="storage">Storage</option>
            <option value="prices">Market Prices</option>
          </select>
        </div>
      </div>
      
      <div className="dashboard-content">
        <div className="map-section">
          <GasOilMap 
            onFeatureSelect={handleFeatureSelect}
            selectedFeature={selectedFeature}
            commodity={commodity}
            indicator={indicator}
          />
        </div>
        
        <div className="detail-section">
          <GasOilDetailPanel 
            feature={selectedFeature} 
            onClose={handleCloseDetail}
            onShowHistory={handleShowHistory}
          />
        </div>
      </div>
      
      {/* Chart Section */}
      <div className="dashboard-charts">
        <div className="chart-section-header">
          <h2>
            {indicator === 'prices' ? 
              `Market Prices - ${selectedBenchmark}` : 
              `${commodity.charAt(0).toUpperCase() + commodity.slice(1)} ${indicator.charAt(0).toUpperCase() + indicator.slice(1)}`}
          </h2>
          <div className="chart-controls">
            {indicator === 'prices' && (
              <select 
                value={selectedBenchmark}
                onChange={(e) => setSelectedBenchmark(e.target.value)}
              >
                <option value="Brent Crude">Brent Crude</option>
                <option value="WTI Crude">WTI Crude</option>
                <option value="Henry Hub">Henry Hub Natural Gas</option>
                <option value="TTF">Dutch TTF Natural Gas</option>
              </select>
            )}
            <select 
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value)}
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>
        </div>
        
        {/* Price Chart */}
        {indicator === 'prices' && priceData.length > 0 && (
          <div className="chart-container">
            <GasOilPriceChart 
              data={priceData}
              benchmark={selectedBenchmark}
              unit={priceData[0]?.unit || 'USD/barrel'}
              timePeriod={timePeriod}
            />
          </div>
        )}
        
        {/* Supply Chart */}
        {indicator !== 'prices' && supplyData.length > 0 && (
          <div className="chart-container">
            <GasOilSupplyChart 
              data={supplyData}
              indicator={indicator}
              unit={supplyData[0]?.unit || ''}
              timePeriod={timePeriod}
            />
          </div>
        )}
        
        {/* Comparison Chart */}
        <div className="chart-container">
          <GasOilComparisonChart 
            data={comparisonData}
            title="Regional Production Comparison"
            unit={supplyData[0]?.unit || ''}
          />
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="dashboard-summary">
        <div className="summary-grid">
          <div className="summary-card">
            <TrendingUp size={20} />
            <div>
              <span>Top Producer</span>
              <strong>Saudi Arabia</strong>
            </div>
          </div>
          <div className="summary-card">
            <TrendingDown size={20} />
            <div>
              <span>Top Consumer</span>
              <strong>United States</strong>
            </div>
          </div>
          <div className="summary-card">
            <Activity size={20} />
            <div>
              <span>Active Pipelines</span>
              <strong>127</strong>
            </div>
          </div>
          <div className="summary-card">
            <Gauge size={20} />
            <div>
              <span>Global Storage</span>
              <strong>1.2B barrels</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GasOilDashboard