import PracticeStreakWidget from '../components/dashboard/PracticeStreakWidget'
import RecentSessionsList from '../components/dashboard/RecentSessionsList'
import ProgressChart from '../components/dashboard/ProgressChart'
import UpNextWidget from '../components/dashboard/UpNextWidget'

export default function Dashboard() {
  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <h1 className="font-heading text-3xl text-amber">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PracticeStreakWidget />
        <UpNextWidget />
      </div>

      <ProgressChart />

      <RecentSessionsList />
    </div>
  )
}
