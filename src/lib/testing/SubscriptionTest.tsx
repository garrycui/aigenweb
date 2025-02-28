
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Function to simulate an expired subscription
export const setSubscriptionState = async (userId: string, state: 'active' | 'expired' | 'trial' | 'trial-expired') => {
  if (!userId) return;
  
  try {
    const userRef = doc(db, 'users', userId);
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + 30);
    const pastDate = new Date();
    pastDate.setDate(now.getDate() - 10);
    
    switch (state) {
      case 'active':
        await updateDoc(userRef, {
          subscriptionStatus: 'active',
          subscriptionEnd: futureDate,
          subscriptionPlan: 'monthly',
          trialEndsAt: pastDate
        });
        console.log('Set subscription to active');
        break;
        
      case 'expired':
        await updateDoc(userRef, {
          subscriptionStatus: 'expired',
          subscriptionEnd: pastDate,
          trialEndsAt: pastDate
        });
        console.log('Set subscription to expired');
        break;
        
      case 'trial':
        await updateDoc(userRef, {
          subscriptionStatus: 'inactive',
          trialEndsAt: futureDate
        });
        console.log('Set user to active trial');
        break;
        
      case 'trial-expired':
        await updateDoc(userRef, {
          subscriptionStatus: 'inactive',
          trialEndsAt: pastDate
        });
        console.log('Set trial to expired');
        break;
    }
    
    return true;
  } catch (error) {
    console.error('Error setting subscription state:', error);
    return false;
  }
};