import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Plus, Trash2} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface LearningGoal {
  id: string;
  title: string;
  description: string;
  progress: number;
  status: 'not_started' | 'in_progress' | 'completed';
  createdAt: Date;
}

const LearningGoals = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: '', description: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGoals();
  }, [user]);

  const loadGoals = async () => {
    if (!user) return;
    try {
      const goalsRef = doc(db, 'users', user.id, 'learningGoals', 'goals');
      const goalsDoc = await getDoc(goalsRef);
      
      if (goalsDoc.exists()) {
        setGoals(goalsDoc.data().goals);
      }
    } catch (error) {
      console.error('Error loading goals:', error);
      setError('Failed to load learning goals');
    }
  };

  const handleAddGoal = async () => {
    if (!user) return;
    if (goals.length >= 3) {
      setError('You can only set up to 3 learning goals');
      return;
    }

    try {
      const newGoalObj: LearningGoal = {
        id: Date.now().toString(),
        title: newGoal.title,
        description: newGoal.description,
        progress: 0,
        status: 'not_started',
        createdAt: new Date()
      };

      const goalsRef = doc(db, 'users', user.id, 'learningGoals', 'goals');
      await setDoc(goalsRef, {
        goals: [...goals, newGoalObj]
      }, { merge: true });

      setGoals(prev => [...prev, newGoalObj]);
      setNewGoal({ title: '', description: '' });
      setIsAddingGoal(false);
      setError(null);
    } catch (error) {
      console.error('Error adding goal:', error);
      setError('Failed to add learning goal');
    }
  };

  const updateGoalProgress = async (goalId: string, progress: number) => {
    if (!user) return;
    try {
      const updatedGoals = goals.map(goal => {
        if (goal.id === goalId) {
          return {
            ...goal,
            progress,
            status: (progress === 100 ? 'completed' : 'in_progress') as 'completed' | 'in_progress'
          };
        }
        return goal;
      });

      const goalsRef = doc(db, 'users', user.id, 'learningGoals', 'goals');
      await updateDoc(goalsRef, { goals: updatedGoals });
      setGoals(updatedGoals);
    } catch (error) {
      console.error('Error updating goal progress:', error);
      setError('Failed to update goal progress');
    }
  };

  const deleteGoal = async (goalId: string) => {
    if (!user) return;
    try {
      const updatedGoals = goals.filter(goal => goal.id !== goalId);
      const goalsRef = doc(db, 'users', user.id, 'learningGoals', 'goals');
      await updateDoc(goalsRef, { goals: updatedGoals });
      setGoals(updatedGoals);
    } catch (error) {
      console.error('Error deleting goal:', error);
      setError('Failed to delete goal');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Learning Goals</h1>
            <p className="text-gray-600">Set and track your AI learning journey</p>
          </div>
          {goals.length < 3 && (
            <button
              onClick={() => setIsAddingGoal(true)}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Goal
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {isAddingGoal && (
          <div className="mb-6 p-4 border border-gray-200 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">New Learning Goal</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Goal Title
                </label>
                <input
                  type="text"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g., Master ChatGPT Prompting"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newGoal.description}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={3}
                  placeholder="Describe what you want to achieve..."
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setIsAddingGoal(false)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddGoal}
                  disabled={!newGoal.title || !newGoal.description}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400"
                >
                  Save Goal
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {goals.map((goal) => (
            <div key={goal.id} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{goal.title}</h3>
                  <p className="text-gray-600">{goal.description}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => deleteGoal(goal.id)}
                    className="p-1 text-gray-500 hover:text-red-600"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Progress</span>
                  <span className="text-sm text-gray-600">{goal.progress}%</span>
                </div>
                <div className="relative pt-1">
                  <div className="flex mb-2 items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-indigo-600 bg-indigo-200">
                        {goal.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-indigo-200">
                    <div
                      style={{ width: `${goal.progress}%` }}
                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-600 transition-all duration-500"
                    ></div>
                  </div>
                  <div className="flex justify-between space-x-2">
                    {[0, 25, 50, 75, 100].map((progress) => (
                      <button
                        key={progress}
                        onClick={() => updateGoalProgress(goal.id, progress)}
                        className={`px-2 py-1 rounded ${
                          goal.progress >= progress
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {progress}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {goals.length === 0 && !isAddingGoal && (
            <div className="text-center py-12">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Learning Goals Set</h3>
              <p className="text-gray-600 mb-4">
                Set up to 3 learning goals to track your progress and get personalized recommendations.
              </p>
              <button
                onClick={() => setIsAddingGoal(true)}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Your First Goal
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LearningGoals;