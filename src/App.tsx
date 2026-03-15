import { Suspense, lazy } from "react"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom"
import { AuthProvider } from "@/contexts/AuthContext"
import ProtectedRoute from "@/components/ProtectedRoute"
import { useUserPlan } from "@/hooks/useUserPlan"
import { AnimatePresence, motion } from "framer-motion"

// Eagerly load critical routes
import Index from "./pages/Index"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"

// Code-split all other routes
const NotFound = lazy(() => import("./pages/NotFound"))
const Pricing = lazy(() => import("./pages/Pricing"))
const Onboarding = lazy(() => import("./pages/Onboarding"))
const Conversation = lazy(() => import("./pages/Conversation"))
const LearnPage = lazy(() => import("./pages/LearnPage"))
const PracticePage = lazy(() => import("./pages/PracticePage"))
const Profile = lazy(() => import("./pages/Profile"))
const Settings = lazy(() => import("./pages/Settings"))
const Leaderboard = lazy(() => import("./pages/Leaderboard"))
const Achievements = lazy(() => import("./pages/Achievements"))
const LanguagePage = lazy(() => import("./pages/LanguagePage"))
const CoursePage = lazy(() => import("./pages/CoursePage"))
const LessonPage = lazy(() => import("./pages/LessonPage"))
const TutorPage = lazy(() => import("./pages/TutorPage"))
const DrivingModePage = lazy(() => import("./pages/DrivingModePage"))
const MusicAdminPage = lazy(() => import("./pages/MusicAdminPage"))
const NewsReaderPage = lazy(() => import("./pages/NewsReaderPage"))
const SRSReviewPage = lazy(() => import("./pages/SRSReviewPage"))
const LanguagesPage = lazy(() => import("./pages/LanguagesPage"))

// Optimized QueryClient with caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5 minutes
      gcTime: 30 * 60 * 1000,       // 30 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function PaidRoute({ children }: { children: React.ReactNode }) {
  const { isPaid, loading } = useUserPlan()
  if (loading) return <PageLoader />
  if (!isPaid) return <Navigate to="/pricing" replace />
  return <>{children}</>
}

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        <Routes location={location}>
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
      </motion.div>
    </AnimatePresence>
  )
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <AnimatedRoutes />
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
)

export default App
