import { Toaster } from "@/components/ui/toaster"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "@/contexts/AuthContext"
import ProtectedRoute from "@/components/ProtectedRoute"
import { useUserPlan } from "@/hooks/useUserPlan"

import Index from "./pages/Index"
import NotFound from "./pages/NotFound"
import Pricing from "./pages/Pricing"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import Onboarding from "./pages/Onboarding"
import Conversation from "./pages/Conversation"
import LearnPage from "./pages/LearnPage"
import PracticePage from "./pages/PracticePage"
import Profile from "./pages/Profile"
import Settings from "./pages/Settings"
import Leaderboard from "./pages/Leaderboard"
import Achievements from "./pages/Achievements"
import LanguagePage from "./pages/LanguagePage"
import CoursePage from "./pages/CoursePage"
import LessonPage from "./pages/LessonPage"
import TutorPage from "./pages/TutorPage"
import DrivingModePage from "./pages/DrivingModePage"
import MusicAdminPage from "./pages/MusicAdminPage"
import NewsReaderPage from "./pages/NewsReaderPage"
import SRSReviewPage from "./pages/SRSReviewPage"
import LanguagesPage from "./pages/LanguagesPage"

const queryClient = new QueryClient()

function PaidRoute({ children }: { children: React.ReactNode }) {
  const { isPaid, loading } = useUserPlan()
  if (loading) return null
  if (!isPaid) return <Navigate to="/pricing" replace />
  return <>{children}</>
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Index />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/login" element={<Login />} />

            {/* Main app — all require auth */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/learn" element={<ProtectedRoute><LearnPage /></ProtectedRoute>} />
            <Route path="/practice" element={<ProtectedRoute><PracticePage /></ProtectedRoute>} />
            <Route path="/conversation" element={<ProtectedRoute><Conversation /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
            <Route path="/achievements" element={<ProtectedRoute><Achievements /></ProtectedRoute>} />

            {/* Languages browser */}
            <Route path="/languages" element={<ProtectedRoute><LanguagesPage /></ProtectedRoute>} />

            {/* Language routes */}
            <Route path="/learn/:slug" element={<ProtectedRoute><LanguagePage /></ProtectedRoute>} />
            <Route path="/learn/:slug/course/:courseId" element={<ProtectedRoute><CoursePage /></ProtectedRoute>} />
            <Route path="/learn/:slug/lesson/:lessonId" element={<ProtectedRoute><LessonPage /></ProtectedRoute>} />
            <Route path="/learn/:slug/review" element={<ProtectedRoute><SRSReviewPage /></ProtectedRoute>} />

            {/* Paid routes */}
            <Route path="/learn/:slug/tutor" element={<ProtectedRoute><PaidRoute><TutorPage /></PaidRoute></ProtectedRoute>} />
            <Route path="/learn/:slug/drive" element={<ProtectedRoute><PaidRoute><DrivingModePage /></PaidRoute></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/admin/music" element={<ProtectedRoute><MusicAdminPage /></ProtectedRoute>} />

            {/* News (protected) */}
            <Route path="/news/:articleId" element={<ProtectedRoute><NewsReaderPage /></ProtectedRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
)

export default App
