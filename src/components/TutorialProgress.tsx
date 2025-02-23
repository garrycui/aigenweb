import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { BookOpen, CheckCircle, Clock } from 'lucide-react';

interface TutorialProgressProps {
  currentSection: number;
  totalSections: number;
  timeSpent: number;
  estimatedTime: number;
  completedSections: number[];
}

const TutorialProgress: React.FC<TutorialProgressProps> = ({
  currentSection,
  totalSections,
  timeSpent,
  estimatedTime,
  completedSections
}) => {
  const progress = (completedSections.length / totalSections) * 100;
  const timeProgress = Math.min((timeSpent / estimatedTime) * 100, 100);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="grid grid-cols-3 gap-6">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-3">
            <CircularProgressbar
              value={progress}
              text={`${Math.round(progress)}%`}
              styles={buildStyles({
                pathColor: '#4f46e5',
                textColor: '#4f46e5',
                trailColor: '#e5e7eb'
              })}
            />
          </div>
          <div className="flex items-center justify-center text-sm text-gray-600">
            <BookOpen className="h-4 w-4 mr-1" />
            <span>Overall Progress</span>
          </div>
        </div>

        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-3">
            <CircularProgressbar
              value={(currentSection / totalSections) * 100}
              text={`${currentSection}/${totalSections}`}
              styles={buildStyles({
                pathColor: '#4f46e5',
                textColor: '#4f46e5',
                trailColor: '#e5e7eb'
              })}
            />
          </div>
          <div className="flex items-center justify-center text-sm text-gray-600">
            <CheckCircle className="h-4 w-4 mr-1" />
            <span>Current Section</span>
          </div>
        </div>

        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-3">
            <CircularProgressbar
              value={timeProgress}
              text={`${timeSpent}m`}
              styles={buildStyles({
                pathColor: '#4f46e5',
                textColor: '#4f46e5',
                trailColor: '#e5e7eb'
              })}
            />
          </div>
          <div className="flex items-center justify-center text-sm text-gray-600">
            <Clock className="h-4 w-4 mr-1" />
            <span>Time Spent</span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Section Progress</span>
          <span>{completedSections.length}/{totalSections} Complete</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default TutorialProgress;