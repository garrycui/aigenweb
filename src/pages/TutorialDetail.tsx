import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ThumbsUp, Eye, Clock, Share2, Bookmark, Code, ChevronRight, ChevronLeft } from 'lucide-react';
import { doc, getDoc, updateDoc, increment, arrayUnion, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Tutorial } from '../lib/tutorials';
import { useAuth } from '../context/AuthContext';
import ReactMarkdown from 'react-markdown';
import CodeEditor from '../components/CodeEditor';
import TutorialProgress from '../components/TutorialProgress';
import ResourceCard from '../components/ResourceCard';

interface QuizAnswer {
  questionId: number;
  selectedAnswer: number;
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
  const [completedSections, setCompletedSections] = useState<number[]>([]);
  const [timeSpent, setTimeSpent] = useState(0);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[]>([]);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [currentQuizQuestion, setCurrentQuizQuestion] = useState(0);
  const [currentResourceIndex, setCurrentResourceIndex] = useState(0);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [currentWebIndex, setCurrentWebIndex] = useState(0);

  const handlePrevResource = () => {
    if (!tutorial) return;
    setCurrentResourceIndex((prev) => (prev > 0 ? prev - 1 : tutorial.resources.webLinks.length + tutorial.resources.videos.length - 1));
  };

  const handleNextResource = () => {
    if (!tutorial) return;
    setCurrentResourceIndex((prev) => (prev < tutorial.resources.webLinks.length + tutorial.resources.videos.length - 1 ? prev + 1 : 0));
  };

  const handlePrevVideo = () => {
    if (!tutorial) return;
    setCurrentVideoIndex((prev) =>
      prev > 0 ? prev - 1 : tutorial.resources.videos.length - 1
    );
  };

  const handleNextVideo = () => {
    if (!tutorial) return;
    setCurrentVideoIndex((prev) =>
      prev < tutorial.resources.videos.length - 1 ? prev + 1 : 0
    );
  };

  const handlePrevWeb = () => {
    if (!tutorial) return;
    setCurrentWebIndex((prev) =>
      prev > 0 ? prev - 1 : tutorial.resources.webLinks.length - 1
    );
  };

  const handleNextWeb = () => {
    if (!tutorial) return;
    setCurrentWebIndex((prev) =>
      prev < tutorial.resources.webLinks.length - 1 ? prev + 1 : 0
    );
  };

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
            setCompletedSections(data.completedSections || []);
            setTimeSpent(data.timeSpent || 0);

            // Show the user's first uncompleted section
            const firstUncompletedSection = tutorialDoc.data().sections.findIndex((_: any, index: number) => !data.completedSections.includes(index));
            setCurrentSection(firstUncompletedSection !== -1 ? firstUncompletedSection : 0);
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

  // Time tracking
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 60000); // Update every minute

    return () => clearInterval(timer);
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

  const handleSectionComplete = async (sectionIndex: number) => {
    if (!user || !tutorial) return;

    try {
      const userInteractionRef = doc(db, 'users', user.id, 'tutorialInteractions', tutorial.id);
      const userInteractionDoc = await getDoc(userInteractionRef);

      if (!userInteractionDoc.exists()) {
        await setDoc(userInteractionRef, {
          completedSections: [sectionIndex],
          timeSpent
        });
      } else {
        const updatedSections = [...completedSections, sectionIndex];
        await updateDoc(userInteractionRef, {
          completedSections: updatedSections,
          timeSpent
        });
        setCompletedSections(updatedSections);
      }

      // Auto jump to the next uncompleted section
      const nextSection = tutorial.sections.findIndex((_, index) => ![...completedSections, sectionIndex].includes(index));
      if (nextSection !== -1) {
        setCurrentSection(nextSection);
      } else {
        setShowQuiz(true);
      }
    } catch (error) {
      console.error('Error marking section as complete:', error);
    }
  };

  const handleQuizSubmit = async () => {
    if (!tutorial || !user) return;

    const correctAnswers = quizAnswers.filter(
      answer => answer.selectedAnswer === tutorial.quiz.questions[answer.questionId].correctAnswer
    ).length;

    const score = (correctAnswers / tutorial.quiz.questions.length) * 100;
    setQuizScore(score);

    if (score >= tutorial.quiz.passingScore) {
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
    }
  };

  const handleQuizAnswer = (questionId: number, selectedAnswer: number) => {
    setQuizAnswers(prev => {
      const existing = prev.find(a => a.questionId === questionId);
      if (existing) {
        return prev.map(a => 
          a.questionId === questionId ? { ...a, selectedAnswer } : a
        );
      }
      return [...prev, { questionId, selectedAnswer }];
    });
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
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

              {/* Section Navigation */}
              <div className="flex justify-between items-center mb-6">
                <button
                  onClick={() => setCurrentSection(prev => Math.max(0, prev - 1))}
                  disabled={currentSection === 0}
                  className="flex items-center text-indigo-600 disabled:text-gray-400"
                >
                  <ChevronLeft className="h-5 w-5" />
                  Previous
                </button>
                <span className="text-gray-600">
                  Section {currentSection + 1} of {tutorial.sections.length}
                </span>
                <button
                  onClick={() => setCurrentSection(prev => Math.min(tutorial.sections.length - 1, prev + 1))}
                  disabled={currentSection === tutorial.sections.length - 1}
                  className="flex items-center text-indigo-600 disabled:text-gray-400"
                >
                  Next
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {/* Current Section Content */}
              <div className="prose max-w-none mb-6">
                <h2 className="text-2xl font-bold mb-4">{tutorial.sections[currentSection].title}</h2>
                <ReactMarkdown
                  components={{
                    a: ({node, ...props}) => <a {...props} className="text-blue-600 hover:underline" />
                  }}
                >
                  {tutorial.sections[currentSection].content}
                </ReactMarkdown>
              </div>

              {/* Code Example */}
              {tutorial.sections[currentSection].codeExample && (
                <div className="mb-6">
                  <CodeEditor
                    initialCode={tutorial.sections[currentSection].codeExample}
                    language={tutorial.sections[currentSection].language || 'javascript'}
                    readOnly
                  />
                </div>
              )}

              {/* Section Complete Button */}
              {!completedSections.includes(currentSection) ? (
                <button
                  onClick={() => handleSectionComplete(currentSection)}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 mb-6"
                >
                  Complete Section
                </button>
              ) : (
                <div className="w-full px-4 py-2 bg-green-100 text-green-800 rounded-lg mb-6 text-center">
                  Section Completed
                </div>
              )}

              {/* Quiz Section */}
              {showQuiz && (
                <div className="mt-8 border-t pt-8">
                  <h2 className="text-2xl font-bold mb-6">Knowledge Check</h2>
                  <div className="space-y-6">
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h3 className="font-medium mb-4">{tutorial.quiz.questions[currentQuizQuestion].question}</h3>
                      <div className="space-y-2">
                        {tutorial.quiz.questions[currentQuizQuestion].options.map((option, optionIndex) => (
                          <button
                            key={optionIndex}
                            onClick={() => handleQuizAnswer(currentQuizQuestion, optionIndex)}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                              quizAnswers.find(a => a.questionId === currentQuizQuestion)?.selectedAnswer === optionIndex
                                ? 'border-indigo-600 bg-indigo-50'
                                : 'border-gray-200 hover:border-indigo-600'
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                      {quizScore !== null && (
                        <div className="mt-4 text-sm">
                          <p className={tutorial.quiz.questions[currentQuizQuestion].correctAnswer === quizAnswers.find(a => a.questionId === currentQuizQuestion)?.selectedAnswer
                            ? 'text-green-600'
                            : 'text-red-600'
                          }>
                            {tutorial.quiz.questions[currentQuizQuestion].explanation}
                          </p>
                        </div>
                      )}
                    </div>
                    {currentQuizQuestion < tutorial.quiz.questions.length - 1 ? (
                      <button
                        onClick={() => setCurrentQuizQuestion(prev => prev + 1)}
                        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                      >
                        Next Question
                      </button>
                    ) : (
                      <button
                        onClick={handleQuizSubmit}
                        disabled={quizAnswers.length !== tutorial.quiz.questions.length}
                        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400"
                      >
                        Submit Quiz
                      </button>
                    )}
                    {quizScore !== null && (
                      <div className={`p-4 rounded-lg ${
                        quizScore >= tutorial.quiz.passingScore
                          ? 'bg-green-50 text-green-800'
                          : 'bg-red-50 text-red-800'
                      }`}>
                        <p className="font-medium">Your Score: {Math.round(quizScore)}%</p>
                        <p>
                          {quizScore >= tutorial.quiz.passingScore
                            ? 'Congratulations! You have passed the quiz!'
                            : `You need ${tutorial.quiz.passingScore}% to pass. Try again!`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between border-t pt-4 mt-6">
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
                  {tutorial.isCodingTutorial && (
                    <button
                      onClick={() => setShowCodeEditor(!showCodeEditor)}
                      className="flex items-center space-x-1 text-gray-500 hover:text-indigo-600"
                    >
                      <Code className="h-5 w-5" />
                      <span>Code Editor</span>
                    </button>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                    {tutorial.difficulty}
                  </span>
                </div>
              </div>
            </div>
          </article>

          {/* Video Tutorials Section */}
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Video Tutorials</h2>
            {tutorial?.resources.videos[currentVideoIndex] && (
              <div className="relative">
                <iframe
                  src={tutorial.resources.videos[currentVideoIndex].url}
                  title={tutorial.resources.videos[currentVideoIndex].title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-96 rounded-lg mb-4"
                ></iframe>
                <button
                  onClick={handlePrevVideo}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-gradient-to-br from-indigo-500 to-purple-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={handleNextVideo}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-br from-indigo-500 to-purple-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <ResourceCard
                  type="video"
                  title={tutorial.resources.videos[currentVideoIndex].title}
                  description={tutorial.resources.videos[currentVideoIndex].description}
                  url={tutorial.resources.videos[currentVideoIndex].url}
                  thumbnail={tutorial.resources.videos[currentVideoIndex].thumbnail}
                />
                {/* Dots for Video */}
                <div className="flex justify-center mt-4 space-x-2">
                  {tutorial.resources.videos.map((_, i) => (
                    <div
                      key={i}
                      onClick={() => setCurrentVideoIndex(i)}
                      className={`h-2 w-2 rounded-full cursor-pointer ${
                        currentVideoIndex === i ? 'bg-indigo-600' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Web Tutorials Section */}
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Web Tutorials</h2>
            {tutorial?.resources.webLinks[currentWebIndex] && (
              <div className="relative">
                <ResourceCard
                  type="web"
                  title={tutorial.resources.webLinks[currentWebIndex].title}
                  description={tutorial.resources.webLinks[currentWebIndex].description}
                  url={tutorial.resources.webLinks[currentWebIndex].url}
                  thumbnail={tutorial.resources.webLinks[currentWebIndex].thumbnail}
                />
                <button
                  onClick={handlePrevWeb}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-gradient-to-br from-indigo-500 to-purple-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={handleNextWeb}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-br from-indigo-500 to-purple-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                {/* Dots for Web */}
                <div className="flex justify-center mt-4 space-x-2">
                  {tutorial.resources.webLinks.map((_, i) => (
                    <div
                      key={i}
                      onClick={() => setCurrentWebIndex(i)}
                      className={`h-2 w-2 rounded-full cursor-pointer ${
                        currentWebIndex === i ? 'bg-indigo-600' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <TutorialProgress
            tutorial={tutorial}
            currentSection={currentSection}
            completedSections={completedSections}
            timeSpent={timeSpent}
          />

          {showCodeEditor && (
            <div className="sticky top-6">
              <CodeEditor
                language={tutorial.sections[currentSection].language || 'javascript'}
                onClose={() => setShowCodeEditor(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TutorialDetail;