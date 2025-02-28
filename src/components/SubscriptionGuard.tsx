import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import SubscriptionModal from './SubscriptionModal';

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ children }) => {
  const { user } = useAuth();
  const [isSubscriptionExpired, setIsSubscriptionExpired] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSubscription = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', user.id);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Check if subscription is expired
          const isExpired = userData.subscriptionStatus === 'expired';
          
          // Also check trial status
          const now = new Date();
          const trialEndsAt = userData.trialEndsAt?.toDate();
          const isTrialExpired = trialEndsAt ? now > trialEndsAt : true;
          
          // Check subscription end date
          const subscriptionEnd = userData.subscriptionEnd?.toDate();
          const isSubscriptionEnded = subscriptionEnd ? now > subscriptionEnd : false;
          
          // User has no access if subscription is expired or ended, and trial is expired
          const hasNoAccess = (isExpired || isSubscriptionEnded) && isTrialExpired;
          
          setIsSubscriptionExpired(hasNoAccess);
          
          // Automatically open modal if subscription is expired
          if (hasNoAccess) {
            setIsModalOpen(true);
          }
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSubscription();
  }, [user, navigate]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Immediately redirect to subscription page when modal is closed
    navigate('/subscription', { replace: true });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // If subscription is expired, show modal and prevent access to the protected content
  if (isSubscriptionExpired) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <SubscriptionModal 
          isOpen={isModalOpen} 
          onClose={handleCloseModal} 
          expiredSubscription={true}
        />
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Subscription Required</h2>
          <p className="text-gray-600 mb-6">Your subscription has expired. Please renew to access this content.</p>
          <button 
            onClick={() => navigate('/subscription')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            View Subscription Options
          </button>
        </div>
      </div>
    );
  }

  // If subscription is active, render the children
  return <>{children}</>;
};

export default SubscriptionGuard;