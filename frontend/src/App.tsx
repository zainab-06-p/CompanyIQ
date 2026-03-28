import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage.tsx";
import LoadingPage from "./pages/LoadingPage.tsx";
import ReportPage from "./pages/ReportPage.tsx";
import ComparePage from "./pages/ComparePage.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import WatchlistPage from "./pages/WatchlistPage.tsx";
import PortfolioPage from "./pages/PortfolioPage.tsx";
import HistoryPage from "./pages/HistoryPage.tsx";
import OnboardingPage from "./pages/OnboardingPage.tsx";

export default function App() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  const handleAuth = (u: any) => {
    setUser(u);
    localStorage.setItem("user", JSON.stringify(u));
  };

  const handlePlanSelected = (selectedPlan: string) => {
    const nextUser = {
      ...(user || {}),
      selectedPlan,
      requiresPlanSelection: false,
    };
    setUser(nextUser);
    localStorage.setItem("user", JSON.stringify(nextUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  const needsOnboarding = Boolean(user?.requiresPlanSelection);

  return (
    <div className="min-h-screen bg-slate-900">
      <Routes>
        <Route
          path="/"
          element={needsOnboarding ? <Navigate to="/onboarding" replace /> : <HomePage user={user} onLogout={handleLogout} />}
        />
        <Route
          path="/loading/:company"
          element={needsOnboarding ? <Navigate to="/onboarding" replace /> : <LoadingPage />}
        />
        <Route
          path="/report/:company"
          element={needsOnboarding ? <Navigate to="/onboarding" replace /> : <ReportPage />}
        />
        <Route
          path="/compare"
          element={needsOnboarding ? <Navigate to="/onboarding" replace /> : <ComparePage />}
        />
        <Route path="/auth" element={<AuthPage onAuth={handleAuth} />} />
        <Route
          path="/watchlist"
          element={needsOnboarding ? <Navigate to="/onboarding" replace /> : <WatchlistPage />}
        />
        <Route
          path="/portfolio"
          element={needsOnboarding ? <Navigate to="/onboarding" replace /> : <PortfolioPage />}
        />
        <Route
          path="/history"
          element={user ? (needsOnboarding ? <Navigate to="/onboarding" replace /> : <HistoryPage />) : <Navigate to="/auth" replace />}
        />
        <Route
          path="/onboarding"
          element={user ? <OnboardingPage user={user} onPlanSelected={handlePlanSelected} /> : <Navigate to="/auth" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
