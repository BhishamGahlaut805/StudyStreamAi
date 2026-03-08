import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider, useAuth } from "./context/authContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./Pages/Home";
import Authentication from "./Pages/authentication";
import StudentDashboard from "./Pages/Dashboard/studentDashboard";
import TestPage from "./Pages/Tests/testPage";
import PracticePage from "./Pages/Tests/practicePage";
import RealTest from "./Pages/Tests/realTest";
import PracticeResult from "./Pages/Tests/practiceResult";
import RealResult from "./Pages/Tests/realResult";
import StartRetentionPage from "./Pages/Retention/StartRetentionPage";
import RetentionPageInterface from "./Pages/Retention/RetentionPageInterface";
import RetentionPageAnalyticsPage from "./Pages/Retention/RetentionPageAnalyticsPage";

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/auth" />;
};

function AppContent() {
  const { isDark } = useTheme();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 transition-colors dark:bg-dark-100 dark:text-gray-100">
      <Navbar />
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Authentication />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="/test/practice" element={<TestPage />} />
          <Route path="/test/interface" element={<PracticePage />} />
          <Route path="/test/real/interface" element={<RealTest />} />
          <Route path="/practice/results" element={<PracticeResult />} />
          <Route path="/test/results" element={<RealResult />} />

          <Route
            path="/retention/start"
            element={
              <ProtectedRoute>
                <StartRetentionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/retention/interface"
            element={
              <ProtectedRoute>
                <RetentionPageInterface />
              </ProtectedRoute>
            }
          />
          <Route
            path="/retention/analytics"
            element={
              <ProtectedRoute>
                <RetentionPageAnalyticsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      <Footer />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: isDark ? "#1e293b" : "#ffffff",
            color: isDark ? "#e2e8f0" : "#0f172a",
            border: isDark ? "1px solid #334155" : "1px solid #cbd5e1",
          },
          success: {
            style: {
              background: isDark ? "#064e3b" : "#ecfdf5",
              color: isDark ? "#d1fae5" : "#065f46",
            },
          },
          error: {
            style: {
              background: isDark ? "#7f1d1d" : "#fef2f2",
              color: isDark ? "#fee2e2" : "#991b1b",
            },
          },
        }}
      />
    </div>
  );
}

function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <AppContent />
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
