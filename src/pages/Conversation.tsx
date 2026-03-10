import DashboardLayout from '@/components/DashboardLayout'

export default function Conversation() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Conversation</h1>
        <p className="text-muted-foreground">Start a conversation to practice.</p>
      </div>
    </DashboardLayout>
  )
}
