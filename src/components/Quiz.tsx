import { useState } from 'react';
import { CheckCircle, XCircle, ArrowRight, RefreshCw } from 'lucide-react';

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface QuizProps {
  questions: QuizQuestion[];
  onComplete: (score: number) => void;
}

const Quiz: React.FC<QuizProps> = ({ questions, onComplete }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleAnswerSelect = (answerIndex: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(answerIndex);
    setShowExplanation(true);

    if (answerIndex === questions[currentQuestion].correctAnswer) {
      setScore(score + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setIsCompleted(true);
      onComplete(score);
    }
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setScore(0);
    setIsCompleted(false);
  };

  if (isCompleted) {
    const percentage = (score / questions.length) * 100;
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Quiz Complete!</h3>
        <div className="mb-6">
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-8 border-indigo-100 flex items-center justify-center">
                <span className="text-3xl font-bold text-indigo-600">{percentage}%</span>
              </div>
              {percentage >= 70 ? (
                <CheckCircle className="absolute -top-2 -right-2 h-8 w-8 text-green-500" />
              ) : (
                <XCircle className="absolute -top-2 -right-2 h-8 w-8 text-red-500" />
              )}
            </div>
          </div>
          <p className="text-center text-gray-600 mb-4">
            You got {score} out of {questions.length} questions correct!
          </p>
          {percentage >= 70 ? (
            <p className="text-center text-green-600 font-medium">Great job! You've passed the quiz!</p>
          ) : (
            <p className="text-center text-red-600 font-medium">Keep practicing to improve your score.</p>
          )}
        </div>
        <button
          onClick={resetQuiz}
          className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <RefreshCw className="h-5 w-5 mr-2" />
          Try Again
        </button>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-600">
            Question {currentQuestion + 1} of {questions.length}
          </span>
          <span className="text-sm font-medium text-gray-600">
            Score: {score}/{questions.length}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <h3 className="text-lg font-medium text-gray-900 mb-4">{currentQ.question}</h3>

      <div className="space-y-3 mb-6">
        {currentQ.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleAnswerSelect(index)}
            disabled={selectedAnswer !== null}
            className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
              selectedAnswer === null
                ? 'border-gray-200 hover:border-indigo-600 hover:bg-indigo-50'
                : index === currentQ.correctAnswer
                ? 'border-green-500 bg-green-50'
                : selectedAnswer === index
                ? 'border-red-500 bg-red-50'
                : 'border-gray-200 opacity-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span>{option}</span>
              {selectedAnswer !== null && index === currentQ.correctAnswer && (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              {selectedAnswer === index && index !== currentQ.correctAnswer && (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </div>
          </button>
        ))}
      </div>

      {showExplanation && (
        <div className={`p-4 rounded-lg mb-6 ${
          selectedAnswer === currentQ.correctAnswer ? 'bg-green-50' : 'bg-red-50'
        }`}>
          <p className={`text-sm ${
            selectedAnswer === currentQ.correctAnswer ? 'text-green-700' : 'text-red-700'
          }`}>
            {currentQ.explanation}
          </p>
        </div>
      )}

      {selectedAnswer !== null && (
        <button
          onClick={handleNextQuestion}
          className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          {currentQuestion < questions.length - 1 ? (
            <>
              Next Question
              <ArrowRight className="h-5 w-5 ml-2" />
            </>
          ) : (
            'Complete Quiz'
          )}
        </button>
      )}
    </div>
  );
};

export default Quiz;