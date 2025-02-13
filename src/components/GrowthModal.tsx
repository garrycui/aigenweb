import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

interface GrowthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PsychRecord {
  id: string;
  rating: number;
  createdAt: any;
}

const GrowthModal: React.FC<GrowthModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [psychRecords, setPsychRecords] = useState<PsychRecord[]>([]);
  const [newRating, setNewRating] = useState<number | ''>('');
  const [trend, setTrend] = useState(0);

  const fetchPsychData = async () => {
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
        createdAt: serverTimestamp(),
      });
      setNewRating('');
      fetchPsychData();
    } catch (error) {
      console.error('Error saving psychology record:', error);
    }
  };

  useEffect(() => {
    if (isOpen) fetchPsychData();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    // Basic modal layout; adjust styles as needed
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black opacity-50" onClick={onClose}></div>
      <div className="bg-white rounded-lg shadow-lg z-50 p-6 max-w-md w-full">
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
          <button
            onClick={handleSubmit}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition mt-2"
          >
            Submit
          </button>
        </div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Your Psychology Trend</h3>
          {psychRecords.length === 0 ? (
            <p className="text-gray-600">No records yet.</p>
          ) : (
            <ul className="mt-2 max-h-40 overflow-y-auto">
              {psychRecords.map(record => (
                <li key={record.id} className="py-1 border-b">
                  Rating: {record.rating} - {record.createdAt?.toDate ? new Date(record.createdAt.toDate()).toLocaleDateString() : 'Pending'}
                </li>
              ))}
            </ul>
          )}
          {psychRecords.length > 1 && (
            <p className="mt-2 text-gray-700">
              Trend: {trend > 0 ? `+${trend}` : trend} change from first record
            </p>
          )}
        </div>
        <button
          onClick={fetchPsychData}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition"
        >
          Refresh Records
        </button>
      </div>
    </div>
  );
};

export default GrowthModal;