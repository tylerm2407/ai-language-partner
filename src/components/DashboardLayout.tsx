import { ReactNode } from 'react'
import AppShell from './AppShell'

// Legacy wrapper — new pages should use AppShell directly
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}
