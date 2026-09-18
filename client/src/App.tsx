import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ToastProvider, ToastViewport } from './components/ui/overlays';
import { AuthProvider } from './hooks/useAuth';
import { AdminPage } from './pages/AdminPage';
import { FeedPage } from './pages/FeedPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { PostDetailPage } from './pages/PostDetailPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { RoadmapPage } from './pages/RoadmapPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { AdminRoute } from './components/AdminRoute';

export default function App() {
  return (
    // Toast.Provider owns the queue that both the Admin page (status-change
    // toasts) and any future feature reads from — it has to sit above every
    // route that might call useToast().
    <ToastProvider>
      <AuthProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<FeedPage />} />
            <Route path="/requests/:slug" element={<PostDetailPage />} />
            <Route path="/roadmap" element={<RoadmapPage />} />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              }
            />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppShell>
      </AuthProvider>
      <ToastViewport />
    </ToastProvider>
  );
}

function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-lg font-medium">Page not found</p>
      <p className="mt-1 text-sm text-muted-foreground">That page doesn't exist.</p>
    </div>
  );
}
