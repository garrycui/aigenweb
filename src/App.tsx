import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Home from './pages/Home';
import Questionnaire from './pages/Questionnaire';
import Forum from './pages/Forum';
import PostDetail from './pages/PostDetail';
import NewPost from './pages/NewPost';
import Dashboard from './pages/Dashboard';
import Assistant from './pages/Assistant';
import Tutorials from './pages/Tutorials';
import TutorialDetail from './pages/TutorialDetail';
import LearningGoals from './pages/LearningGoals';
import { PostProvider } from './context/PostContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import TrialBanner from './components/TrialBanner';
import ExpiredBanner from './components/ExpiredBanner';
import SubscriptionModal from './components/SubscriptionModal';

function App() {
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);

  return (
    <AuthProvider>
      <PostProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <div className="min-h-screen bg-gray-50">
            <TrialBanner onUpgrade={() => setIsSubscriptionModalOpen(true)} />
            <ExpiredBanner onUpgrade={() => setIsSubscriptionModalOpen(true)} />
            <Navbar />
            <main className="container mx-auto px-4 py-8">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route 
                  path="/questionnaire" 
                  element={
                    <ProtectedRoute>
                      <Questionnaire />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/forum" 
                  element={
                    <ProtectedRoute>
                      <Forum />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/forum/:id" 
                  element={
                    <ProtectedRoute>
                      <PostDetail />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/forum/new" 
                  element={
                    <ProtectedRoute>
                      <NewPost />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/assistant" 
                  element={
                    <ProtectedRoute>
                      <Assistant />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/tutorials" 
                  element={
                    <ProtectedRoute>
                      <Tutorials />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/tutorials/:id" 
                  element={
                    <ProtectedRoute>
                      <TutorialDetail />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/learning-goals" 
                  element={
                    <ProtectedRoute>
                      <LearningGoals />
                    </ProtectedRoute>
                  } 
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            
            <SubscriptionModal
              isOpen={isSubscriptionModalOpen}
              onClose={() => setIsSubscriptionModalOpen(false)}
            />
          </div>
        </Router>
      </PostProvider>
    </AuthProvider>
  );
}

export default App;