import React from 'react';
import AIChat from '../components/AIChat';
import DailyContent from '../components/DailyContent';

const Assistant = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-6">
        {/* Daily Inspiration */}
        <DailyContent />
        
        {/* AI Chat Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">How can I help you today?</h2>
          <AIChat />
        </div>
      </div>
    </div>
  );
};

export default Assistant;