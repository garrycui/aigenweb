
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { setSubscriptionState } from '../lib/testing/SubscriptionTest';

const TestingPanel = () => {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  
  const handleSetSubscription = async (state: 'active' | 'expired' | 'trial' | 'trial-expired') => {
    if (!user) {
      setMessage('No user is logged in');
      return;
    }
    
    setIsProcessing(true);
    try {
      await setSubscriptionState(user.id, state);
      setMessage(`Subscription state set to: ${state}`);
    } catch (error) {
      console.error('Error:', error);
      setMessage('Failed to set subscription state');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') return null;
  
  return (
    <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg z-50 border border-gray-200">
      <div className="text-sm font-bold mb-2">Subscription Testing</div>
      
      <div className="flex flex-col gap-2">
        <button 
          onClick={() => handleSetSubscription('active')}
          className="px-4 py-1 bg-green-500 text-white text-sm rounded"
          disabled={isProcessing}
        >
          Set Active
        </button>
        
        <button 
          onClick={() => handleSetSubscription('expired')}
          className="px-4 py-1 bg-red-500 text-white text-sm rounded"
          disabled={isProcessing}
        >
          Set Expired
        </button>
        
        <button 
          onClick={() => handleSetSubscription('trial')}
          className="px-4 py-1 bg-blue-500 text-white text-sm rounded"
          disabled={isProcessing}
        >
          Set Trial
        </button>
        
        <button 
          onClick={() => handleSetSubscription('trial-expired')}
          className="px-4 py-1 bg-orange-500 text-white text-sm rounded"
          disabled={isProcessing}
        >
          Expire Trial
        </button>
      </div>
      
      {message && <div className="mt-2 text-xs">{message}</div>}
    </div>
  );
};

export default TestingPanel;