import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CreditCard, Clock, Shield, CheckCircle } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PLANS, createCheckoutSession } from '../lib/stripe';

const UserSubscription = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionData, setSubscriptionData] = useState<{
    status: string;
    plan: string;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null>(null);

  useEffect(() => {
    const loadSubscription = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        const userRef = doc(db, 'users', user.id);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          setSubscriptionData({
            status: data.subscriptionStatus || 'inactive',
            plan: data.subscriptionPlan || '',
            currentPeriodEnd: data.subscriptionEnd?.toDate() || null,
            cancelAtPeriodEnd: data.cancelAtPeriodEnd || false
          });
        }
      } catch (error) {
        console.error('Error loading subscription:', error);
        setError('Failed to load subscription data');
      } finally {
        setIsLoading(false);
      }
    };

    loadSubscription();
  }, [user]);

  const handleUpgrade = async (priceId: string) => {
    if (!user) return;
    try {
      await createCheckoutSession(user.id, priceId);
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setError('Failed to start upgrade process');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="bg-indigo-100 p-3 rounded-full">
              <CreditCard className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Subscription</h1>
              <p className="text-gray-600">Manage your subscription and billing</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Current Subscription Status */}
          <div className="mb-8 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Current Plan</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">
                  {subscriptionData?.plan ? `${subscriptionData.plan} Plan` : 'Free Trial'}
                </p>
                <p className="text-sm text-gray-600">
                  {subscriptionData?.currentPeriodEnd
                    ? `Next billing date: ${subscriptionData.currentPeriodEnd.toLocaleDateString()}`
                    : 'No active subscription'}
                </p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                subscriptionData?.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {subscriptionData?.status === 'active' ? 'Active' : 'Inactive'}
              </div>
            </div>
          </div>

          {/* Available Plans */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Monthly Plan */}
            <div className="border rounded-lg p-6 hover:border-indigo-600 transition-colors">
              <h3 className="text-xl font-semibold mb-2">{PLANS.MONTHLY.name}</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold">${PLANS.MONTHLY.price}</span>
                <span className="text-gray-600">/month</span>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Full access to all features</span>
                </li>
                <li className="flex items-center">
                  <Clock className="h-5 w-5 text-green-500 mr-2" />
                  <span>Cancel anytime</span>
                </li>
                <li className="flex items-center">
                  <Shield className="h-5 w-5 text-green-500 mr-2" />
                  <span>Priority support</span>
                </li>
              </ul>
              <button
                onClick={() => handleUpgrade(PLANS.MONTHLY.id)}
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {subscriptionData?.plan === 'monthly' ? 'Current Plan' : 'Switch to Monthly'}
              </button>
            </div>

            {/* Annual Plan */}
            <div className="border-2 border-indigo-600 rounded-lg p-6 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-sm">
                  Best Value
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-2">{PLANS.ANNUAL.name}</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold">${PLANS.ANNUAL.price}</span>
                <span className="text-gray-600">/year</span>
                <div className="text-green-600 text-sm font-medium">
                  Save {PLANS.ANNUAL.discount}
                </div>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>All monthly plan features</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Two months free</span>
                </li>
                <li className="flex items-center">
                  <Shield className="h-5 w-5 text-green-500 mr-2" />
                  <span>Premium support</span>
                </li>
              </ul>
              <button
                onClick={() => handleUpgrade(PLANS.ANNUAL.id)}
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {subscriptionData?.plan === 'annual' ? 'Current Plan' : 'Switch to Annual'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSubscription;