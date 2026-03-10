import DashboardLayout from '@/components/DashboardLayout'

export default function Leaderboard() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Leaderboard</h1>
        <p className="text-muted-foreground">See how you rank.</p>
      </div>
    </DashboardLayout>
  )
}
