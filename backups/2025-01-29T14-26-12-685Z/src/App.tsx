import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Home from './pages/Home';
import Questionnaire from './pages/Questionnaire';
import Forum from './pages/Forum';
import PostDetail from './pages/PostDetail';
import NewPost from './pages/NewPost';
import Dashboard from './pages/Dashboard';
import { PostProvider } from './context/PostContext';
import { AuthProvider } from './context/AuthContext';

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
                <Route path="/questionnaire" element={<Questionnaire />} />
                <Route path="/forum" element={<Forum />} />
                <Route path="/forum/:id" element={<PostDetail />} />
                <Route path="/forum/new" element={<NewPost />} />
                <Route path="/dashboard" element={<Dashboard />} />
              </Routes>
            </main>
          </div>
        </Router>
      </PostProvider>
    </AuthProvider>
  );
}

export default App;