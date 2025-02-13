import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ThumbsUp, Eye, Clock, Share2, Bookmark } from 'lucide-react';
import { doc, getDoc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Tutorial } from '../lib/tutorials';
import { useAuth } from '../context/AuthContext';
import ReactMarkdown from 'react-markdown';

const TutorialDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [tutorial, setTutorial] = useState<Tutorial | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);

  useEffect(() => {
    const loadTutorial = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        const tutorialRef = doc(db, 'tutorials', id);
        const tutorialDoc = await getDoc(tutorialRef);

        if (!tutorialDoc.exists()) {
          setError('Tutorial not found');
          return;
        }

        // Increment view count
        await updateDoc(tutorialRef, {
          views: increment(1)
        });

        // Get user's interaction status if logged in
        if (user) {
          const userInteractionRef = doc(db, 'users', user.id, 'tutorialInteractions', id);
          const userInteractionDoc = await getDoc(userInteractionRef);
          if (userInteractionDoc.exists()) {
            const data = userInteractionDoc.data();
            setIsLiked(data.liked || false);
            setIsBookmarked(data.bookmarked || false);
          }

          // Check if tutorial is marked as completed
          const userDocRef = doc(db, 'users', user.id);
          const userDoc = await getDoc(userDocRef);
          const completed = userDoc.data()?.completedTutorials || [];
          if (completed.includes(id)) {
            setIsCompleted(true);
          }
        }

        setTutorial({
          id: tutorialDoc.id,
          ...tutorialDoc.data()
        } as Tutorial);
      } catch (err) {
        console.error('Error loading tutorial:', err);
        setError('Failed to load tutorial');
      } finally {
        setIsLoading(false);
      }
    };

    loadTutorial();
  }, [id, user]);

  const handleLike = async () => {
    if (!user || !tutorial) return;

    try {
      const tutorialRef = doc(db, 'tutorials', tutorial.id);
      const userInteractionRef = doc(db, 'users', user.id, 'tutorialInteractions', tutorial.id);

      await updateDoc(tutorialRef, {
        likes: increment(isLiked ? -1 : 1)
      });

      await updateDoc(userInteractionRef, {
        liked: !isLiked
      });

      setIsLiked(!isLiked);
      setTutorial(prev => prev ? {
        ...prev,
        likes: prev.likes + (isLiked ? -1 : 1)
      } : null);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleBookmark = async () => {
    if (!user || !tutorial) return;

    try {
      const userInteractionRef = doc(db, 'users', user.id, 'tutorialInteractions', tutorial.id);
      await updateDoc(userInteractionRef, {
        bookmarked: !isBookmarked
      });
      setIsBookmarked(!isBookmarked);
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  const handleShare = async () => {
    if (!tutorial) return;

    try {
      await navigator.share({
        title: tutorial.title,
        text: 'Check out this tutorial on AI Adapt!',
        url: window.location.href
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleMarkCompleted = async () => {
    if (!user || !tutorial) return;

    try {
      const userDocRef = doc(db, 'users', user.id);
      await updateDoc(userDocRef, {
        completedTutorials: arrayUnion(tutorial.id)
      });
      setIsCompleted(true);
      setShowCongrats(true);
      setTimeout(() => setShowCongrats(false), 3000);
    } catch (error) {
      console.error('Error marking tutorial as completed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !tutorial) {
    return (
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error || 'Tutorial not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4">
      {showCongrats && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-green-100 text-green-800 rounded-lg shadow-lg">
          Congratulations on completing the tutorial!
        </div>
      )}
      <Link 
        to="/tutorials"
        className="inline-flex items-center text-indigo-600 hover:text-indigo-800 mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Tutorials
      </Link>

      <article className="bg-white rounded-lg shadow-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-sm font-medium rounded-full">
              {tutorial.category}
            </span>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-gray-500">
                <Clock className="h-4 w-4 mr-1" />
                <span>{tutorial.estimatedMinutes} min read</span>
              </div>
              <div className="flex items-center text-gray-500">
                <Eye className="h-4 w-4 mr-1" />
                <span>{tutorial.views}</span>
              </div>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {tutorial.title}
          </h1>

          <div className="prose max-w-none mb-6">
            <ReactMarkdown>{tutorial.content}</ReactMarkdown>
          </div>

          {user && (
            <div className="mb-6">
              {isCompleted ? (
                <button className="px-4 py-2 bg-green-600 text-white rounded-lg cursor-default" disabled>
                  Completed
                </button>
              ) : (
                <button
                  onClick={handleMarkCompleted}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Mark as Completed
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleLike}
                className={`flex items-center space-x-1 ${
                  isLiked
                    ? 'text-indigo-600'
                    : 'text-gray-500 hover:text-indigo-600'
                }`}
              >
                <ThumbsUp className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
                <span>{tutorial.likes}</span>
              </button>
              <button
                onClick={handleBookmark}
                className={`flex items-center space-x-1 ${
                  isBookmarked
                    ? 'text-indigo-600'
                    : 'text-gray-500 hover:text-indigo-600'
                }`}
              >
                <Bookmark className={`h-5 w-5 ${isBookmarked ? 'fill-current' : ''}`} />
                <span>Save</span>
              </button>
              <button
                onClick={handleShare}
                className="flex items-center space-x-1 text-gray-500 hover:text-indigo-600"
              >
                <Share2 className="h-5 w-5" />
                <span>Share</span>
              </button>
            </div>
            <div className="text-sm text-gray-500">
              <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                {tutorial.difficulty}
              </span>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
};

export default TutorialDetail;