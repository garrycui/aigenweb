import { useState, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import TrialBanner from './components/TrialBanner';
import ExpiredBanner from './components/ExpiredBanner';
import SubscriptionModal from './components/SubscriptionModal';
import SubscriptionGuard from './components/SubscriptionGuard';
import { PostProvider } from './context/PostContext';
import PageTransition from './components/PageTransition';
import Loader from './components/Loader';

// Lazy-loaded components
const Questionnaire = lazy(() => import('./pages/Questionnaire'));
const Forum = lazy(() => import('./pages/Forum'));
const PostDetail = lazy(() => import('./pages/PostDetail'));
const NewPost = lazy(() => import('./pages/NewPost'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Assistant = lazy(() => import('./pages/Assistant'));
const Tutorials = lazy(() => import('./pages/Tutorials'));
const TutorialDetail = lazy(() => import('./pages/TutorialDetail'));
const LearningGoals = lazy(() => import('./pages/LearningGoals'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const UserSettings = lazy(() => import('./pages/UserSettings'));
const UserSubscription = lazy(() => import('./pages/UserSubscription'));

// Enhanced loading component
const PageLoader = () => (
  <div className="flex justify-center items-center min-h-[400px]">
    <Loader variant="neural" text="Loading" size="lg" />
  </div>
);

function App() {
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const location = useLocation();
  
  return (
    <PostProvider>
      <div className="min-h-screen bg-gray-50">
        <TrialBanner onUpgrade={() => setIsSubscriptionModalOpen(true)} />
        <ExpiredBanner onUpgrade={() => setIsSubscriptionModalOpen(true)} />
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <PageTransition transition="fade">
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route 
                path="/subscription" 
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <UserSubscription />
                    </Suspense>
                  </ProtectedRoute>
                } 
              />
              
              {/* Protected and subscription-required routes */}
              <Route 
                path="/questionnaire" 
                element={
                  <ProtectedRoute>
                    <SubscriptionGuard>
                      <Suspense fallback={<PageLoader />}>
                        <Questionnaire />
                      </Suspense>
                    </SubscriptionGuard>
                  </ProtectedRoute>
                } 
              />

              {/* Apply SubscriptionGuard to other premium features */}
              <Route 
                path="/forum" 
                element={
                  <ProtectedRoute>
                    <SubscriptionGuard>
                      <Suspense fallback={<PageLoader />}>
                        <Forum />
                      </Suspense>
                    </SubscriptionGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/forum/new" 
                element={
                  <ProtectedRoute>
                    <SubscriptionGuard>
                      <Suspense fallback={<PageLoader />}>
                        <NewPost />
                      </Suspense>
                    </SubscriptionGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/forum/:id" 
                element={
                  <ProtectedRoute>
                    <SubscriptionGuard>
                      <Suspense fallback={<PageLoader />}>
                        <PostDetail />
                      </Suspense>
                    </SubscriptionGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <SubscriptionGuard>
                      <Suspense fallback={<PageLoader />}>
                        <Dashboard />
                      </Suspense>
                    </SubscriptionGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/assistant" 
                element={
                  <ProtectedRoute>
                    <SubscriptionGuard>
                      <Suspense fallback={<PageLoader />}>
                        <Assistant />
                      </Suspense>
                    </SubscriptionGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/tutorials" 
                element={
                  <ProtectedRoute>
                    <SubscriptionGuard>
                      <Suspense fallback={<PageLoader />}>
                        <Tutorials />
                      </Suspense>
                    </SubscriptionGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/tutorials/:id" 
                element={
                  <ProtectedRoute>
                    <SubscriptionGuard>
                      <Suspense fallback={<PageLoader />}>
                        <TutorialDetail />
                      </Suspense>
                    </SubscriptionGuard>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/learning-goals" 
                element={
                  <ProtectedRoute>
                    <SubscriptionGuard>
                      <Suspense fallback={<PageLoader />}>
                        <LearningGoals />
                      </Suspense>
                    </SubscriptionGuard>
                  </ProtectedRoute>
                } 
              />
              
              {/* These routes are free and don't need subscription guard */}
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <UserProfile />
                    </Suspense>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <UserSettings />
                    </Suspense>
                  </ProtectedRoute>
                } 
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </PageTransition>
        </main>
        
        <SubscriptionModal
          isOpen={isSubscriptionModalOpen}
          onClose={() => setIsSubscriptionModalOpen(false)}
        />
        
        {/* Remove the testing panel */}
        {/* {process.env.NODE_ENV === 'development' && <TestingPanel />} */}
      </div>
    </PostProvider>
  );
}

export default App;