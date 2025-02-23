import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ThumbsUp, Eye, Clock, Share2, Bookmark, ChevronDown, ChevronUp } from 'lucide-react';
import { doc, getDoc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Tutorial } from '../lib/tutorials';
import { useAuth } from '../context/AuthContext';
import ReactMarkdown from 'react-markdown';
import CodeEditor from '../components/CodeEditor';
import Quiz from '../components/Quiz';
import TutorialProgress from '../components/TutorialProgress';

interface Section {
  title: string;
  content: string;
  codeExample?: string;
}

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

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
  const [currentSection, setCurrentSection] = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);
  const [completedSections, setCompletedSections] = useState<number[]>([]);
  const [expandedSections, setExpandedSections] = useState<number[]>([0]);
  const timerRef = useRef<NodeJS.Timeout>();

  // Mock sections and quiz data (in a real app, this would come from your backend)
  const sections: Section[] = [
    {
      title: "Introduction",
      content: tutorial?.content.split('\n\n')[0] || '',
    },
    {
      title: "Getting Started",
      content: tutorial?.content.split('\n\n')[1] || '',
      codeExample: `// Example code
console.log("Hello, World!");
const sum = (a, b) => a + b;
console.log(sum(5, 3));`
    },
    {
      title: "Advanced Concepts",
      content: tutorial?.content.split('\n\n')[2] || '',
      codeExample: `// Advanced example
class Calculator {
  add(a, b) {
    return a + b;
  }
  
  multiply(a, b) {
    return a * b;
  }
}

const calc = new Calculator();
console.log(calc.multiply(4, 3));`
    }
  ];

  const quizQuestions: QuizQuestion[] = [
    {
      id: 1,
      question: "What is the main purpose of this tutorial?",
      options: [
        "To introduce basic concepts",
        "To demonstrate advanced techniques",
        "To provide practical examples",
        "To explain theoretical foundations"
      ],
      correctAnswer: 2,
      explanation: "This tutorial focuses on providing practical examples to help you understand the concepts better."
    },
    {
      id: 2,
      question: "Which approach is recommended in the tutorial?",
      options: [
        "Trial and error",
        "Step-by-step learning",
        "Memorization",
        "Random practice"
      ],
      correctAnswer: 1,
      explanation: "The tutorial emphasizes a structured, step-by-step approach to learning the material."
    }
  ];

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

  // Track time spent
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 60000); // Update every minute

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

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

  const handleSectionComplete = (sectionIndex: number) => {
    if (!completedSections.includes(sectionIndex)) {
      setCompletedSections([...completedSections, sectionIndex]);
    }
  };

  const toggleSection = (sectionIndex: number) => {
    setExpandedSections(prev => 
      prev.includes(sectionIndex)
        ? prev.filter(i => i !== sectionIndex)
        : [...prev, sectionIndex]
    );
  };

  const handleQuizComplete = (score: number) => {
    if (score >= 70) {
      handleMarkCompleted();
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

      <div className="space-y-6">
        <TutorialProgress
          currentSection={currentSection}
          totalSections={sections.length}
          timeSpent={timeSpent}
          estimatedTime={tutorial.estimatedMinutes}
          completedSections={completedSections}
        />

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

            <h1 className="text-3xl font-bold text-gray-900 mb-6">
              {tutorial.title}
            </h1>

            <div className="space-y-6">
              {sections.map((section, index) => (
                <div key={index} className="border rounded-lg">
                  <button
                    onClick={() => toggleSection(index)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div className="flex items-center">
                      <span className="font-medium text-gray-900">{section.title}</span>
                      {completedSections.includes(index) && (
                        <span className="ml-2 text-green-500">✓</span>
                      )}
                    </div>
                    {expandedSections.includes(index) ? (
                      <ChevronUp className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    )}
                  </button>

                  {expandedSections.includes(index) && (
                    <div className="p-4 border-t">
                      <div className="prose max-w-none mb-6">
                        <ReactMarkdown>{section.content}</ReactMarkdown>
                      </div>

                      {section.codeExample && (
                        <div className="mb-6">
                          <CodeEditor
                            initialCode={section.codeExample}
                            language="javascript"
                          />
                        </div>
                      )}

                      <button
                        onClick={() => handleSectionComplete(index)}
                        disabled={completedSections.includes(index)}
                        className={`px-4 py-2 rounded-lg ${
                          completedSections.includes(index)
                            ? 'bg-green-100 text-green-700 cursor-default'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        {completedSections.includes(index) ? 'Completed' : 'Mark as Complete'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Knowledge Check</h2>
              <Quiz
                questions={quizQuestions}
                onComplete={handleQuizComplete}
              />
            </div>

            <div className="flex items-center justify-between border-t mt-8 pt-4">
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
    </div>
  );
};

export default TutorialDetail;