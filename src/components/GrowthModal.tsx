import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';

interface GrowthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void; // New prop to call when data is updated
}

interface PsychRecord {
  id: string;
  rating: number;
  feedback: string;
  createdAt: any;
}

const GrowthModal: React.FC<GrowthModalProps> = ({ isOpen, onClose, onUpdate }) => {
  const { user } = useAuth();
  const [psychRecords, setPsychRecords] = useState<PsychRecord[]>([]);
  const [newRating, setNewRating] = useState<number | ''>('');
  const [feedback, setFeedback] = useState<string>('');
  const [trend, setTrend] = useState(0);

  const fetchPsychData = async () => {
    if (!user) return;
    try {
      const collRef = collection(db, 'users', user.id, 'psychologyRecords');
      const q = query(collRef, orderBy('createdAt', 'asc'));
      const snapshot = await getDocs(q);
      const records: PsychRecord[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as { rating: number; feedback: string; createdAt: any }),
      }));
      setPsychRecords(records);
      if (records.length > 1) {
        const firstRating = records[0].rating;
        const lastRating = records[records.length - 1].rating;
        setTrend(lastRating - firstRating);
      }
    } catch (error) {
      console.error('Error fetching psychology records:', error);
    }
  };

  const handleSubmit = async () => {
    if (!user || newRating === '') return;
    try {
      const collRef = collection(db, 'users', user.id, 'psychologyRecords');
      await addDoc(collRef, {
        rating: newRating,
        feedback: feedback,
        createdAt: serverTimestamp(),
      });
      setNewRating('');
      setFeedback('');
      fetchPsychData();
      onUpdate(); // Call the onUpdate function to refresh data on the dashboard
    } catch (error) {
      console.error('Error saving psychology record:', error);
    }
  };

  useEffect(() => {
    if (isOpen) fetchPsychData();
  }, [isOpen]);

  const chartData = {
    labels: psychRecords.map(record => new Date(record.createdAt.toDate()).toLocaleDateString()),
    datasets: [{
      label: 'Empowerment Rating Trend',
      data: psychRecords.map(record => record.rating),
      fill: false,
      borderColor: 'rgba(75,192,192,1)',
    }],
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black opacity-50" onClick={onClose}></div>
      <div className="bg-white rounded-lg shadow-lg z-50 p-6 max-w-md w-full overflow-y-auto max-h-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Mind Empowerment Tracker</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">&times;</button>
        </div>
        <div className="mb-4">
          <p className="text-gray-700">How empowered do you feel today? (Rate 1-10)</p>
          <input
            type="number"
            min="1"
            max="10"
            value={newRating}
            onChange={(e) => setNewRating(Number(e.target.value))}
            className="border rounded px-2 py-1 mt-2 w-full"
          />
          <textarea
            placeholder="Share your thoughts"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="border rounded px-2 py-1 mt-2 w-full"
          />
          <button
            onClick={handleSubmit}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition mt-2"
          >
            Submit
          </button>
        </div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Your Psychological Trend</h3>
          {psychRecords.length === 0 ? (
            <p className="text-gray-600">No records yet.</p>
          ) : (
            <Line data={chartData} />
          )}
          {psychRecords.length > 1 && (
            <p className="mt-2 text-gray-700">
              Trend: {trend > 0 ? `+${trend}` : trend} change from first record
            </p>
          )}
        </div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Motivational Tips</h3>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li>Take regular breaks to recharge your mind.</li>
            <li>Set small, achievable goals to maintain momentum.</li>
            <li>Practice mindfulness and meditation to reduce stress.</li>
            <li>Engage in activities that you enjoy and find fulfilling.</li>
            <li>Connect with a supportive community or mentor.</li>
          </ul>
        </div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Empowerment Messages</h3>
          <p className="text-gray-700">"Believe in yourself and all that you are. Know that there is something inside you that is greater than any obstacle." - Christian D. Larson</p>
        </div>
      </div>
    </div>
  );
};

export default GrowthModal;
