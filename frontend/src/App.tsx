import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Navigation } from './components/shared/Navigation';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { JoinPage } from './components/auth/JoinPage';
import { ChildHome } from './pages/ChildHome';
import { ParentHome } from './pages/ParentHome';
import { MomentsPage } from './pages/MomentsPage';
import { AlbumPage } from './pages/AlbumPage';
import { CalendarPage } from './pages/CalendarPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';

function AppRoutes() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'register' | 'join'>('login');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    switch (authView) {
      case 'register':
        return <RegisterPage onSwitchToLogin={() => setAuthView('login')} />;
      case 'join':
        return <JoinPage onSwitchToLogin={() => setAuthView('login')} />;
      default:
        return (
          <LoginPage
            onSwitchToRegister={() => setAuthView('register')}
            onSwitchToJoin={() => setAuthView('join')}
          />
        );
    }
  }

  const isParent = user?.role === 'parent';

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={isParent ? <ParentHome /> : <ChildHome />}
        />
        <Route path="/moments" element={<MomentsPage />} />
        <Route path="/album" element={<AlbumPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/join/:code" element={<JoinPage onSwitchToLogin={() => {}} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Navigation />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/*" element={<AppRoutes />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
