import React from 'react';
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
import { PostProvider } from './context/PostContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <PostProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
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
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </Router>
      </PostProvider>
    </AuthProvider>
  );
}

export default App;