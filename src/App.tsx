import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ErrorBoundary } from './utils/errorBoundary';
import { isSupabaseConfigured } from './lib/supabase';
import { Auth } from './components/Auth';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Campaigns } from './components/Campaigns';
import EditCampaign from './components/EditCampaign';
import { SequenceEditorChat } from './components/SequenceEditorChat';
import { Inbox } from './components/Inbox';
import { AdminPanel } from './components/AdminPanel';
import { Settings } from './components/Settings';
import { Targeting } from './components/Targeting';
import { ListsManager } from './components/ListsManager';

function App() {
  // Show setup message if Supabase is not configured
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 1.79 4 4 4h8c0 2.21 1.79 4 4 4V7c0-2.21-1.79-4-4-4H8c-2.21 0-4 1.79-4 4z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Database Setup Required
          </h2>
          <p className="text-gray-600 mb-4">
            Please click "Connect to Supabase" in the top right to set up your database connection.
          </p>
          <div className="text-sm text-gray-500">
            Once connected, you'll be able to use all features of the Cold Outreach SaaS platform.
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <div className="min-h-screen">
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/" element={<Layout />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="campaigns" element={<Campaigns />} />
                  <Route path="campaigns/:id/edit" element={<EditCampaign />} />
                  <Route path="campaigns/:id/chat" element={<SequenceEditorChat />} />
                  <Route path="booked" element={<Inbox />} />
                  <Route path="targeting" element={<Targeting />} />
                  <Route path="lists" element={<ListsManager />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="admin" element={<AdminPanel />} />
                </Route>
              </Routes>
            </div>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;