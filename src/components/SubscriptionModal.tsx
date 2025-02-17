import React from 'react';
import { Check, X } from 'lucide-react';
import { PLANS, createCheckoutSession } from '../lib/stripe';
import { useAuth } from '../context/AuthContext';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  trialDaysLeft?: number;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose, trialDaysLeft }) => {
  const { user } = useAuth();

  if (!isOpen) return null;

  const handleSubscribe = async (priceId: string) => {
    if (!user) return;
    try {
      await createCheckoutSession(user.id, priceId);
    } catch (error) {
      console.error('Error creating checkout session:', error);
    }
  };

  const features = [
    'Personalized AI adaptation insights',
    'Access to all tutorials and guides',
    'Community forum participation',
    'AI chat assistant',
    'Progress tracking and analytics',
    'Exclusive webinars and resources',
    'Priority support',
    'Advanced AI tools integration',
    'Custom learning paths'
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-auto">
          <div className="absolute right-4 top-4">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900">
                {trialDaysLeft ? 'Upgrade Your Experience' : 'Choose Your Plan'}
              </h2>
              {trialDaysLeft ? (
                <p className="mt-2 text-lg text-gray-600">
                  {trialDaysLeft} days left in your trial. Don't miss out on these amazing features!
                </p>
              ) : (
                <p className="mt-2 text-lg text-gray-600">
                  Start your {PLANS.MONTHLY.trialDays}-day free trial today. Cancel anytime.
                </p>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Monthly Plan */}
              <div className="border rounded-lg p-6 hover:border-indigo-600 transition-colors">
                <h3 className="text-xl font-semibold mb-2">{PLANS.MONTHLY.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">${PLANS.MONTHLY.price}</span>
                  <span className="text-gray-600">/month</span>
                </div>
                <ul className="space-y-3 mb-6">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <Check className="h-5 w-5 text-green-500 mr-2" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(PLANS.MONTHLY.id)}
                  className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Start Monthly Plan
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
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <Check className="h-5 w-5 text-green-500 mr-2" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(PLANS.ANNUAL.id)}
                  className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Start Annual Plan
                </button>
              </div>
            </div>

            <div className="mt-8 text-center text-sm text-gray-500">
              By subscribing, you agree to our Terms of Service and Privacy Policy.
              You can cancel your subscription at any time.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionModal;