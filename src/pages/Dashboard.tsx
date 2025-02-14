import { useState, useEffect } from 'react';
import { BookOpen, Target, Trophy, TrendingUp, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AIChat from '../components/AIChat';
import DailyContent from '../components/DailyContent';
import ReviewModal from '../components/ReviewModal';
import TutorialCard from '../components/TutorialCard';
import ProgressModal from '../components/ProgressModal';
import BadgesModal from '../components/BadgesModal';
import { useReviewPrompt } from '../hooks/useReviewPrompt';
import { getRecommendedTutorials, Tutorial } from '../lib/tutorials';
import { getUserBadges, checkAndAwardBadges, Badge } from '../lib/badges';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getLatestAssessment } from '../lib/api'; // <-- new import
import GrowthModal from '../components/GrowthModal'; // ensure file name matches exactly

interface UserProgress {
  assessment: boolean;
  goals: {
    total: number;
    completed: number;
  };
  tutorials: {
    total: number;
    completed: number;
  };
  posts: {
    total: number;
    published: number;
  };
}

interface PsychRecord {
  id: string;
  rating: number;
  createdAt: any;
}

const Dashboard = () => {
  const { showReview, setShowReview } = useReviewPrompt();
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(showReview);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [isBadgesModalOpen, setIsBadgesModalOpen] = useState(false);
  const [isGrowthModalOpen, setIsGrowthModalOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [recommendedTutorials, setRecommendedTutorials] = useState<Tutorial[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [progress, setProgress] = useState<UserProgress>({
    assessment: false,
    goals: { total: 3, completed: 0 },
    tutorials: { total: 10, completed: 0 },
    posts: { total: 5, published: 0 }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [completedTutorialIds, setCompletedTutorialIds] = useState<string[]>([]);
  const [psychRecords, setPsychRecords] = useState<PsychRecord[]>([]);
  const [latestRating, setLatestRating] = useState<number>(0);
  const [psychTrend, setPsychTrend] = useState<number>(0);

  // New function to refresh badges on demand
  const refreshBadges = async () => {
    if (!user) return;
    try {
      await checkAndAwardBadges(user.id);
      const userBadges = await getUserBadges(user.id);
      setBadges(userBadges);
    } catch (error) {
      console.error('Error refreshing badges:', error);
    }
  };

  useEffect(() => {
    if (!user) return;

    const loadDashboardData = async () => {
      try {
        setIsLoading(true);
        
        // Load user progress from user doc
        const userRef = doc(db, 'users', user.id);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        
        setCompletedTutorialIds(userData?.completedTutorials || []);

        // Get learning goals
        const goalsRef = doc(db, 'users', user.id, 'learningGoals', 'goals');
        const goalsDoc = await getDoc(goalsRef);
        const goals = goalsDoc.data()?.goals || [];
        const completedGoals = goals.filter((g: any) => g.status === 'completed').length;

        // Get completed tutorials and published posts counts from userData
        const completedTutorials = userData?.completedTutorials?.length || 0;
        const publishedPosts = userData?.publishedPosts?.length || 0;

        // Fetch latest assessment status from the API
        const assessmentResult = await getLatestAssessment(user.id);

        setProgress({
          assessment: !!assessmentResult.data, // update assessment status based on returned data
          goals: {
            total: 3,
            completed: completedGoals
          },
          tutorials: {
            total: 10,
            completed: completedTutorials
          },
          posts: {
            total: 5,
            published: publishedPosts
          }
        });

        // Award badges if criteria met and then fetch updated badges
        await checkAndAwardBadges(user.id);
        const userBadges = await getUserBadges(user.id);
        setBadges(userBadges);

        // Load recommended tutorials
        const recTutorials = await getRecommendedTutorials(user.id, completedTutorialIds, 3);
        setRecommendedTutorials(recTutorials);

      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [user]);

  const fetchPsychDataForDashboard = async () => {
    if (!user) return;
    try {
      const collRef = collection(db, 'users', user.id, 'psychologyRecords');
      const q = query(collRef, orderBy('createdAt', 'asc'));
      const snapshot = await getDocs(q);
      const records: PsychRecord[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as { rating: number; createdAt: any }),
      }));
      setPsychRecords(records);
      if (records.length) {
        setLatestRating(records[records.length - 1].rating);
      }
      if (records.length > 1) {
        const first = records[0].rating;
        const last = records[records.length - 1].rating;
        setPsychTrend(last - first);
      }
    } catch (error) {
      console.error('Error fetching psychology data for dashboard:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPsychDataForDashboard();
    }
  }, [user]);

  const handleTutorialClick = (tutorialId: string) => {
    navigate(`/tutorials/${tutorialId}`);
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  const completionRate = Math.round(
    ((progress.assessment ? 1 : 0) +
      progress.goals.completed / progress.goals.total +
      progress.tutorials.completed / progress.tutorials.total +
      progress.posts.published / progress.posts.total) /
      4 *
      100
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Your AI Adaptation Journey</h1>
        <p className="text-gray-600 mt-2">Track your progress and access personalized resources</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <button
          onClick={() => setIsProgressModalOpen(true)}
          className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="bg-indigo-100 p-3 rounded-lg">
              <Target className="h-6 w-6 text-indigo-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Progress</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{completionRate}%</h3>
          <p className="text-gray-600 text-sm">Completion rate</p>
        </button>

        <button
          onClick={async () => { await refreshBadges(); setIsBadgesModalOpen(true); }}
          className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-100 p-3 rounded-lg">
              <Trophy className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Achievements</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{badges.length}</h3>
          <p className="text-gray-600 text-sm">Badges earned</p>
        </button>

        <Link
          to="/tutorials"
          className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Learning</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{progress.tutorials.completed}</h3>
          <p className="text-gray-600 text-sm">Tutorials completed</p>
        </Link>

        <button
          onClick={() => setIsGrowthModalOpen(true)}
          className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="bg-purple-100 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Mind Tracker</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {latestRating ? `Rating: ${latestRating}` : 'No Data'}
          </h3>
          {psychRecords.length > 1 && (
            <p className="text-gray-600 text-sm">
              Trend: {psychTrend > 0 ? `+${psychTrend}` : psychTrend}
            </p>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <DailyContent />
          
          {/* Recommended Tutorials Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Recommended Tutorials</h2>
              <Link 
                to="/tutorials" 
                className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
              >
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
            {recommendedTutorials.length === 0 ? (
              <p className="text-center text-gray-600">No recommended tutorials available</p>
            ) : (
              <div className="flex flex-col gap-4">
                {recommendedTutorials.map((tutorial) => (
                  <TutorialCard
                    key={tutorial.id}
                    tutorial={tutorial}
                    onClick={handleTutorialClick}
                    isCompleted={completedTutorialIds.includes(tutorial.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <AIChat />
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Learning Path</h2>
            <div className="relative">
              <div className="absolute left-4 top-0 h-full w-0.5 bg-gray-200"></div>
              <div className="space-y-6">
                <div className="relative flex items-center">
                  <div className={`absolute left-4 -ml-2 h-4 w-4 rounded-full border-2 ${
                    progress.assessment
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white border-gray-300'
                  }`}></div>
                  <div className="ml-8">
                    <h3 className="font-medium text-gray-900">Complete Assessment</h3>
                    <p className="text-sm text-gray-500">
                      {progress.assessment ? 'Completed' : 'Pending'}
                    </p>
                  </div>
                </div>

                <div className="relative flex items-center">
                  <div className={`absolute left-4 -ml-2 h-4 w-4 rounded-full border-2 ${
                    progress.goals.completed > 0
                      ? progress.goals.completed === progress.goals.total
                        ? 'bg-green-500 border-green-500'
                        : 'bg-yellow-500 border-yellow-500'
                      : 'bg-white border-gray-300'
                  }`}></div>
                  <div className="ml-8">
                    <Link to="/learning-goals" className="font-medium text-gray-900 hover:text-indigo-600">
                      Set Learning Goals
                    </Link>
                    <p className="text-sm text-gray-500">
                      {progress.goals.completed === 0
                        ? 'Not Started'
                        : progress.goals.completed === progress.goals.total
                        ? 'Completed'
                        : 'In Progress'}
                    </p>
                  </div>
                </div>

                <div className="relative flex items-center">
                  <div className={`absolute left-4 -ml-2 h-4 w-4 rounded-full border-2 ${
                    progress.tutorials.completed > 0
                      ? progress.tutorials.completed >= 5
                        ? 'bg-green-500 border-green-500'
                        : 'bg-yellow-500 border-yellow-500'
                      : 'bg-white border-gray-300'
                  }`}></div>
                  <div className="ml-8">
                    <h3 className="font-medium text-gray-900">Complete Tutorials</h3>
                    <p className="text-sm text-gray-500">
                      {progress.tutorials.completed === 0
                        ? 'Not Started'
                        : progress.tutorials.completed >= 5
                        ? 'Completed'
                        : 'In Progress'}
                    </p>
                  </div>
                </div>

                <div className="relative flex items-center">
                  <div className={`absolute left-4 -ml-2 h-4 w-4 rounded-full border-2 ${
                    progress.posts.published > 0
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white border-gray-300'
                  }`}></div>
                  <div className="ml-8">
                    <h3 className="font-medium text-gray-900">Join Community Discussion</h3>
                    <p className="text-sm text-gray-500">
                      {progress.posts.published > 0 ? 'Completed' : 'Pending'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setShowReview(false);
        }}
        platform="web"
      />

      <ProgressModal
        isOpen={isProgressModalOpen}
        onClose={() => setIsProgressModalOpen(false)}
        progress={progress}
      />

      <BadgesModal
        isOpen={isBadgesModalOpen}
        onClose={() => setIsBadgesModalOpen(false)}
        badges={badges}
      />
      
      <GrowthModal
        isOpen={isGrowthModalOpen}
        onClose={() => setIsGrowthModalOpen(false)}
        onUpdate={fetchPsychDataForDashboard} // Pass the function to update data
      />
    </div>
  );
};

export default Dashboard;