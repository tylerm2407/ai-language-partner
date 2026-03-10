import DashboardLayout from '@/components/DashboardLayout'

export default function Onboarding() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Welcome</h1>
        <p className="text-muted-foreground">Let's get you set up.</p>
      </div>
    </DashboardLayout>
  )
}
