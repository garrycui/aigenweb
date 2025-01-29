import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, Users, LayoutDashboard, Menu, X, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, signOut } = useAuth();

  const NavLinks = () => (
    <>
      {user ? (
        <>
          <Link 
            to="/questionnaire" 
            className="flex items-center space-x-1 text-gray-600 hover:text-indigo-600"
            onClick={() => setIsMenuOpen(false)}
          >
            <span>Assessment</span>
          </Link>
          <Link 
            to="/forum" 
            className="flex items-center space-x-1 text-gray-600 hover:text-indigo-600"
            onClick={() => setIsMenuOpen(false)}
          >
            <Users className="h-4 w-4" />
            <span>Community</span>
          </Link>
          <Link 
            to="/dashboard" 
            className="flex items-center space-x-1 text-gray-600 hover:text-indigo-600"
            onClick={() => setIsMenuOpen(false)}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>
          <div className="flex items-center space-x-4 text-gray-600">
            <span className="font-medium border-r pr-4">{user.name}</span>
            <button
              onClick={() => {
                signOut();
                setIsMenuOpen(false);
              }}
              className="flex items-center space-x-1 hover:text-indigo-600"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </>
      ) : (
        <Link
          to="/login"
          className="flex items-center space-x-1 text-gray-600 hover:text-indigo-600"
          onClick={() => setIsMenuOpen(false)}
        >
          <span>Sign In</span>
        </Link>
      )}
    </>
  );

  return (
    <nav className="bg-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <Brain className="h-8 w-8 text-indigo-600" />
            <span className="text-xl font-bold text-gray-800">AI Adapt</span>
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex space-x-8">
            <NavLinks />
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 bg-white border-t">
            <div className="flex flex-col space-y-4 p-4">
              <NavLinks />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;