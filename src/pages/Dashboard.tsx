import React from 'react';
import { BookOpen, Target, Trophy, TrendingUp } from 'lucide-react';
import AIChat from '../components/AIChat';
import DailyContent from '../components/DailyContent';

const Dashboard = () => {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Your AI Adaptation Journey</h1>
        <p className="text-gray-600 mt-2">Track your progress and access personalized resources</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-indigo-100 p-3 rounded-lg">
              <Target className="h-6 w-6 text-indigo-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Progress</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">75%</h3>
          <p className="text-gray-600 text-sm">Completion rate</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-100 p-3 rounded-lg">
              <Trophy className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Achievements</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">12</h3>
          <p className="text-gray-600 text-sm">Badges earned</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Learning</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">8</h3>
          <p className="text-gray-600 text-sm">Courses completed</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-purple-100 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Growth</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">+15%</h3>
          <p className="text-gray-600 text-sm">Monthly improvement</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <DailyContent />
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recommended Resources</h2>
            <div className="space-y-4">
              {[
                "Introduction to Machine Learning",
                "AI Ethics and Best Practices",
                "Practical AI Tools for Productivity"
              ].map((course, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="bg-indigo-100 p-2 rounded">
                      <BookOpen className="h-5 w-5 text-indigo-600" />
                    </div>
                    <span className="font-medium text-gray-800">{course}</span>
                  </div>
                  <button className="text-indigo-600 hover:text-indigo-700">Start</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <AIChat />
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Learning Path</h2>
            <div className="relative">
              <div className="absolute left-4 top-0 h-full w-0.5 bg-gray-200"></div>
              <div className="space-y-6">
                {[
                  { title: "Complete Assessment", status: "completed" },
                  { title: "Set Learning Goals", status: "completed" },
                  { title: "Start Basic Course", status: "in-progress" },
                  { title: "Join Community Discussion", status: "pending" }
                ].map((step, index) => (
                  <div key={index} className="relative flex items-center">
                    <div className={`absolute left-4 -ml-2 h-4 w-4 rounded-full border-2 ${
                      step.status === 'completed' ? 'bg-green-500 border-green-500' :
                      step.status === 'in-progress' ? 'bg-yellow-500 border-yellow-500' :
                      'bg-white border-gray-300'
                    }`}></div>
                    <div className="ml-8">
                      <h3 className="font-medium text-gray-900">{step.title}</h3>
                      <p className="text-sm text-gray-500 capitalize">{step.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;