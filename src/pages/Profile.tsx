import DashboardLayout from '@/components/DashboardLayout'

export default function Profile() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Profile</h1>
        <p className="text-muted-foreground">Your profile details.</p>
      </div>
    </DashboardLayout>
  )
}
