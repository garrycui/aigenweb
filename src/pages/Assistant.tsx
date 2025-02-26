import { useState } from 'react';
import AIChat from '../components/AIChat';
import DailyContent from '../components/DailyContent';
import { Download, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const Assistant = () => {
  const { user } = useAuth();
  const [showControls, setShowControls] = useState(false);
  
  const clearChatHistory = async () => {
    if (!user || !window.confirm('Are you sure you want to clear your chat history?')) return;
    
    try {
      await deleteDoc(doc(db, 'chatHistory', user.id));
      window.location.reload();
    } catch (error) {
      console.error('Error clearing chat history:', error);
      alert('Failed to clear chat history. Please try again.');
    }
  };
  
  const exportChatHistory = async () => {
    if (!user) return;
    
    // Implementation for exporting chat history as JSON
    // This would be implemented in a real application
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-6">
        {/* Daily Inspiration */}
        <DailyContent />
        
        {/* AI Chat Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">How can I help you today?</h2>
            {user && (
              <div className="relative">
                <button 
                  className="text-gray-600 hover:text-gray-800"
                  onClick={() => setShowControls(!showControls)}
                >
                  •••
                </button>
                {showControls && (
                  <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                    <button 
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                      onClick={exportChatHistory}
                    >
                      <Download className="h-4 w-4 mr-2" /> Export Chat
                    </button>
                    <button 
                      className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-gray-100 w-full text-left"
                      onClick={clearChatHistory}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Clear History
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <AIChat />
        </div>
      </div>
    </div>
  );
};

export default Assistant;