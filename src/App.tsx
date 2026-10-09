import { useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  ChevronDown,
  CircleHelp,
  Command,
  CreditCard,
  Download,
  LayoutDashboard,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Settings2,
  ShoppingBag,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Range = '7 days' | '30 days' | '90 days'

const chartData: Record<Range, { date: string; revenue: number; previous: number }[]> = {
  '7 days': [
    { date: 'Mon', revenue: 18, previous: 14 },
    { date: 'Tue', revenue: 23, previous: 19 },
    { date: 'Wed', revenue: 20, previous: 16 },
    { date: 'Thu', revenue: 31, previous: 21 },
    { date: 'Fri', revenue: 27, previous: 23 },
    { date: 'Sat', revenue: 38, previous: 28 },
    { date: 'Sun', revenue: 42, previous: 31 },
  ],
  '30 days': [
    { date: 'Oct 1', revenue: 18, previous: 14 },
    { date: 'Oct 5', revenue: 23, previous: 19 },
    { date: 'Oct 9', revenue: 20, previous: 16 },
    { date: 'Oct 13', revenue: 31, previous: 21 },
    { date: 'Oct 17', revenue: 27, previous: 23 },
    { date: 'Oct 21', revenue: 38, previous: 28 },
    { date: 'Oct 25', revenue: 34, previous: 30 },
    { date: 'Oct 31', revenue: 46, previous: 33 },
  ],
  '90 days': [
    { date: 'Aug 4', revenue: 16, previous: 12 },
    { date: 'Aug 15', revenue: 21, previous: 17 },
    { date: 'Aug 26', revenue: 19, previous: 16 },
    { date: 'Sep 6', revenue: 29, previous: 20 },
    { date: 'Sep 17', revenue: 25, previous: 22 },
    { date: 'Sep 28', revenue: 36, previous: 26 },
    { date: 'Oct 9', revenue: 33, previous: 28 },
    { date: 'Oct 20', revenue: 43, previous: 31 },
    { date: 'Oct 31', revenue: 46, previous: 33 },
  ],
}

const activities = [
  { initials: 'JM', name: 'Jordan Morgan', detail: 'Pro plan · Annual', amount: '$240.00', time: '2 min ago', tone: 'mint' },
  { initials: 'AL', name: 'Avery Lee', detail: 'Studio plan · Monthly', amount: '$48.00', time: '18 min ago', tone: 'peach' },
  { initials: 'SK', name: 'Sam Kim', detail: 'Pro plan · Monthly', amount: '$24.00', time: '41 min ago', tone: 'blue' },
  { initials: 'RP', name: 'Riley Patel', detail: 'Starter plan · Monthly', amount: '$12.00', time: '1 hr ago', tone: 'yellow' },
]

const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Sales', icon: CreditCard },
  { label: 'Customers', icon: Users },
  { label: 'Products', icon: Package },
]

const metrics = [
  { label: 'Total revenue', value: '$48,294', change: '+12.8%', direction: 'up', icon: CreditCard, note: 'vs. last month' },
  { label: 'Orders', value: '1,429', change: '+8.2%', direction: 'up', icon: ShoppingBag, note: 'vs. last month' },
  { label: 'New customers', value: '384', change: '+4.6%', direction: 'up', icon: Users, note: 'vs. last month' },
  { label: 'Refund rate', value: '1.24%', change: '-0.3%', direction: 'down', icon: Activity, note: 'vs. last month' },
]

function App() {
  const [range, setRange] = useState<Range>('30 days')
  const [activePage, setActivePage] = useState('Overview')

  function downloadReport() {
    const rows = [
      ['Metric', 'Value', 'Change'],
      ['Total revenue', '$48,294', '+12.8%'],
      ['Orders', '1,429', '+8.2%'],
      ['New customers', '384', '+4.6%'],
      ['Refund rate', '1.24%', '-0.3%'],
    ]
    const csv = rows.map((row) => row.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'northstar-monthly-report.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Northstar home">
          <span className="brand-mark"><Command size={17} strokeWidth={2.5} /></span>
          <span>northstar<span className="brand-period">.</span></span>
        </a>

        <div className="workspace-switcher">
          <div className="workspace-avatar">S</div>
          <span className="workspace-copy"><strong>Studio North</strong><small>Free workspace</small></span>
          <ChevronDown size={15} />
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              className={`nav-item ${activePage === label ? 'active' : ''}`}
              key={label}
              onClick={() => setActivePage(label)}
              type="button"
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {label === 'Sales' && <span className="nav-count">4</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item" type="button" onClick={() => setActivePage('Settings')}>
            <Settings2 size={17} strokeWidth={1.8} /><span>Settings</span>
          </button>
          <button className="nav-item" type="button" onClick={() => setActivePage('Help center')}>
            <CircleHelp size={17} strokeWidth={1.8} /><span>Help center</span>
          </button>
          <div className="profile">
            <div className="profile-photo">AM</div>
            <span className="workspace-copy"><strong>Alex Morgan</strong><small>Owner</small></span>
            <MoreHorizontal size={18} />
          </div>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-divider">/</span><strong>{activePage}</strong></div>
          <div className="topbar-actions">
            <button className="icon-button search-button" type="button" aria-label="Search"><Search size={17} /></button>
            <button className="icon-button notification-button" type="button" aria-label="Notifications"><Bell size={17} /><span /></button>
            <div className="topbar-divider" />
            <button className="date-button" type="button"><span className="date-dot" />Oct 1 — Oct 31, 2026<ChevronDown size={14} /></button>
          </div>
        </header>

        <div className="dashboard-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> THURSDAY, OCTOBER 9, 2026</div>
              <h1>Good morning, Alex<span className="heading-comma">.</span></h1>
              <p>Here’s what’s happening with your store today.</p>
            </div>
            <button className="primary-button" onClick={downloadReport} type="button"><Download size={16} />Export report</button>
          </section>

          <section className="metrics-grid" aria-label="Key performance indicators">
            {metrics.map(({ label, value, change, direction, icon: Icon, note }, index) => (
              <article className={`metric-card metric-card-${index + 1}`} key={label}>
                <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={16} strokeWidth={1.8} /></span></div>
                <div className="metric-value">{value}</div>
                <div className="metric-foot">
                  <span className={`change-pill ${direction}`}>
                    {direction === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{change}
                  </span>
                  <span className="metric-note">{note}</span>
                </div>
              </article>
            ))}
          </section>

          <section className="chart-panel" aria-labelledby="revenue-heading">
            <div className="panel-heading chart-heading">
              <div>
                <div className="section-kicker">THE BIG PICTURE</div>
                <div className="title-line"><h2 id="revenue-heading">Revenue over time</h2><span className="live-dot" /></div>
              </div>
              <div className="chart-controls">
                <div className="chart-legend"><span className="legend-current" />Revenue<span className="legend-previous" />Previous period</div>
                <div className="range-switch" role="group" aria-label="Chart time range">
                  {(['7 days', '30 days', '90 days'] as const).map((option) => (
                    <button className={range === option ? 'selected' : ''} key={option} onClick={() => setRange(option)} type="button">{option.replace(' ', '')}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="chart-summary"><strong>$48,294</strong><span className="summary-change"><ArrowUpRight size={14} />12.8%</span><span className="metric-note">compared to previous period</span></div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData[range]} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#387c65" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#387c65" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#e9ebe6" strokeDasharray="3 5" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#999e98', fontSize: 11 }} tickMargin={12} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#999e98', fontSize: 11 }} tickFormatter={(value: number) => `$${value}k`} tickCount={5} />
                  <Tooltip
                    contentStyle={{ border: '1px solid #e6e9e3', borderRadius: 8, boxShadow: '0 8px 24px #18251d12', fontSize: 12 }}
                    formatter={(value, name) => [`$${value}k`, name === 'revenue' ? 'Revenue' : 'Previous period']}
                    labelStyle={{ color: '#252c28', fontWeight: 600, marginBottom: 4 }}
                  />
                  <Area type="monotone" dataKey="previous" stroke="#c6cbc4" strokeWidth={1.5} strokeDasharray="4 5" fill="transparent" activeDot={false} />
                  <Area type="monotone" dataKey="revenue" stroke="#387c65" strokeWidth={2.5} fill="url(#revenueFill)" activeDot={{ r: 4, fill: '#387c65', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="activity-panel" aria-labelledby="activity-heading">
            <div className="panel-heading activity-heading">
              <div>
                <div className="section-kicker">FRESH OFF THE PRESS</div>
                <h2 id="activity-heading">Recent activity</h2>
              </div>
              <button className="text-button" type="button" onClick={() => setActivePage('Sales')}>View all <ArrowUpRight size={14} /></button>
            </div>
            <div className="activity-table-wrap">
              <table className="activity-table">
                <thead><tr><th>CUSTOMER</th><th>PLAN</th><th>AMOUNT</th><th>WHEN</th></tr></thead>
                <tbody>
                  {activities.map((item) => (
                    <tr key={item.name}>
                      <td><div className="customer-cell"><span className={`customer-avatar ${item.tone}`}>{item.initials}</span><strong>{item.name}</strong></div></td>
                      <td className="plan-cell">{item.detail}</td>
                      <td className="amount-cell">{item.amount}</td>
                      <td className="time-cell">{item.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="mobile-activity-link" type="button" onClick={() => setActivePage('Sales')}>All transactions <ArrowUpRight size={14} /></button>
          </section>

          <footer className="page-footer"><span>Made for the long view.</span><span>Northstar Analytics <span className="footer-separator">·</span> Updated just now</span></footer>
        </div>
      </main>
      <button className="quick-add" aria-label="Create report" onClick={downloadReport} type="button"><Plus size={20} /></button>
    </div>
  )
}

export default App