import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Settings, Bell, Lock} from 'lucide-react';
import { getUser, updateUser } from '../lib/cache'; // Import user service

// Common timezones list to use as fallback
const commonTimezones = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland'
];

// Helper function to get available timezones
const getAvailableTimezones = (): string[] => {
  try {
    // Use type assertion to bypass TypeScript error
    const intlWithSupport = Intl as any;
    if (typeof intlWithSupport.supportedValuesOf === 'function') {
      return intlWithSupport.supportedValuesOf('timeZone');
    }
  } catch (error) {
    console.warn('Intl.supportedValuesOf not available, using fallback timezone list');
  }
  return commonTimezones;
};

const UserSettings = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      push: true,
      weeklyDigest: true,
      newFeatures: true
    },
    privacy: {
      profileVisibility: 'public',
      showActivity: true,
      showProgress: true
    },
    preferences: {
      theme: 'light',
      language: 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  });

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        const userData = await getUser(user.id);
        if (userData && userData.settings) {
          setSettings(userData.settings);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        setError('Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setIsSubmitting(true);
      setError(null);

      await updateUser(user.id, {
        settings
      });

      setError('Settings saved successfully!');

    } catch (error) {
      console.error('Error updating settings:', error);
      setError('Failed to update settings');
    } finally {
      setIsSubmitting(false);
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
              <Settings className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
              <p className="text-gray-600">Manage your preferences and account settings</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Notification Settings */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Bell className="h-5 w-5 mr-2" />
                Notification Settings
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium text-gray-700">Email Notifications</label>
                    <p className="text-sm text-gray-500">Receive updates via email</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.email}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      notifications: {
                        ...prev.notifications,
                        email: e.target.checked
                      }
                    }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium text-gray-700">Weekly Digest</label>
                    <p className="text-sm text-gray-500">Get a summary of your progress</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.weeklyDigest}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      notifications: {
                        ...prev.notifications,
                        weeklyDigest: e.target.checked
                      }
                    }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium text-gray-700">New Features</label>
                    <p className="text-sm text-gray-500">Be notified about new features</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.newFeatures}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      notifications: {
                        ...prev.notifications,
                        newFeatures: e.target.checked
                      }
                    }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>

            {/* Privacy Settings */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Lock className="h-5 w-5 mr-2" />
                Privacy Settings
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="font-medium text-gray-700">Profile Visibility</label>
                  <select
                    value={settings.privacy.profileVisibility}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      privacy: {
                        ...prev.privacy,
                        profileVisibility: e.target.value
                      }
                    }))}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                    <option value="members">Members Only</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium text-gray-700">Show Activity</label>
                    <p className="text-sm text-gray-500">Display your learning activity</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.privacy.showActivity}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      privacy: {
                        ...prev.privacy,
                        showActivity: e.target.checked
                      }
                    }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium text-gray-700">Show Progress</label>
                    <p className="text-sm text-gray-500">Display your learning progress</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.privacy.showProgress}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      privacy: {
                        ...prev.privacy,
                        showProgress: e.target.checked
                      }
                    }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>

            {/* Preferences */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Preferences
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="font-medium text-gray-700">Theme</label>
                  <select
                    value={settings.preferences.theme}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        theme: e.target.value
                      }
                    }))}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">System</option>
                  </select> </div>

                <div>
                  <label className="font-medium text-gray-700">Language</label>
                  <select
                    value={settings.preferences.language}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        language: e.target.value
                      }
                    }))}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="zh">Chinese</option>
                  </select>
                </div>

                <div>
                  <label className="font-medium text-gray-700">Timezone</label>
                  <select
                    value={settings.preferences.timezone}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        timezone: e.target.value
                      }
                    }))}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    {getAvailableTimezones().map((timezone: string) => (
                      <option key={timezone} value={timezone}>
                        {timezone}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-6 py-2 bg-indigo-600 text-white rounded-lg transition-colors ${
                  isSubmitting ? 'bg-indigo-400 cursor-not-allowed' : 'hover:bg-indigo-700'
                }`}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserSettings;