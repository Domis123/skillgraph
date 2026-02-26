import { getGraph, getStats } from '@/lib/api';
import { Dashboard } from '@/components/Dashboard';

export const revalidate = 30; // Revalidate every 30s

export default async function HomePage() {
  let graphData, stats;

  try {
    [graphData, stats] = await Promise.all([getGraph(), getStats()]);
  } catch (e) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'JetBrains Mono', monospace", color: '#ff3333',
      }}>
        <pre>{`+──────────────────────────────────+
│  ERROR: API UNREACHABLE          │
│                                  │
│  Check Railway deployment        │
│  or set NEXT_PUBLIC_API_URL      │
+──────────────────────────────────+`}</pre>
      </div>
    );
  }

  return <Dashboard graphData={graphData} stats={stats} />;
}
