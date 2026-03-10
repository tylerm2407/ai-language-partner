import DashboardLayout from '@/components/DashboardLayout'

export default function Settings() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Settings</h1>
        <p className="text-muted-foreground">Manage your preferences.</p>
      </div>
    </DashboardLayout>
  )
}
