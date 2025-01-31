import React, { useState, useEffect } from 'react';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLatestAssessment } from '../lib/api';

type ValidationErrors = {
  email?: string;
  password?: string;
  name?: string;
};

const Login = () => {
  const navigate = useNavigate();
  const { signIn, signUp, user, isLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  useEffect(() => {
    const checkUserAssessment = async () => {
      if (user && !isLoading) {
        try {
          const { data: assessment } = await getLatestAssessment(user.id);
          if (assessment) {
            navigate('/assistant', { replace: true });
          } else {
            navigate('/questionnaire', { replace: true });
          }
        } catch (error) {
          console.error('Error checking assessment:', error);
          navigate('/questionnaire', { replace: true });
        }
      }
    };

    checkUserAssessment();
  }, [user, isLoading, navigate]);

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};
    let isValid = true;

    if (!email) {
      errors.email = 'Email is required';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Please enter a valid email address';
      isValid = false;
    }

    if (!password) {
      errors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 6) {
      errors.password = 'Password should be at least 6 characters';
      isValid = false;
    }

    if (!isLogin && !name.trim()) {
      errors.name = 'Full name is required';
      isValid = false;
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setValidationErrors({});

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (isLogin) {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setError(signInError);
          return;
        }
      } else {
        const { error: signUpError } = await signUp(email, password, name);
        if (signUpError) {
          setError(signUpError);
          return;
        }
        setSignUpSuccess(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    setError('');
    setValidationErrors({});
    setPassword('');
  };

  const renderErrorMessage = (message: string) => (
    <div className="flex items-start mt-1">
      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 mr-1" />
      <span className="text-sm text-red-600">{message}</span>
    </div>
  );

  return (
    <div className="max-w-md mx-auto">
      {signUpSuccess ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="mb-4 text-green-500">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Account Created Successfully</h2>
          <p className="text-gray-600 mb-6">
            You can now sign in with your email and password.
          </p>
          <button
            onClick={() => {
              setSignUpSuccess(false);
              setIsLogin(true);
              setEmail('');
              setPassword('');
            }}
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Return to Sign In
          </button>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <p className="text-red-600">{error}</p>
              </div>
              <button
                onClick={handleRetry}
                className="text-sm text-red-600 hover:text-red-800 font-medium mt-2"
              >
                Try again
              </button>
            </div>
          )}
          
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-8">
              <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">
                {isLogin ? 'Welcome Back' : 'Start Your Journey'}
              </h2>

              <div className="flex border-b border-gray-200 mb-6">
                <button
                  className={`flex-1 py-2 text-center ${
                    isLogin
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => {
                    setIsLogin(true);
                    setValidationErrors({});
                    setError('');
                  }}
                >
                  Sign In
                </button>
                <button
                  className={`flex-1 py-2 text-center ${
                    !isLogin
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => {
                    setIsLogin(false);
                    setValidationErrors({});
                    setError('');
                  }}
                >
                  Sign Up
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {!isLogin && (
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Full Name
                    </label>
                    <div className="mt-1">
                      <input
                        id="name"
                        type="text"
                        required={!isLogin}
                        className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                          validationErrors.name ? 'border-red-300' : 'border-gray-300'
                        }`}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                      {validationErrors.name && renderErrorMessage(validationErrors.name)}
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email address
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="email"
                      type="email"
                      required
                      className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                        validationErrors.email ? 'border-red-300' : 'border-gray-300'
                      }`}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <Mail className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                  </div>
                  {validationErrors.email && renderErrorMessage(validationErrors.email)}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="password"
                      type="password"
                      required
                      className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                        validationErrors.password ? 'border-red-300' : 'border-gray-300'
                      }`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <Lock className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                  </div>
                  {validationErrors.password && renderErrorMessage(validationErrors.password)}
                  {!isLogin && !validationErrors.password && (
                    <p className="mt-2 text-sm text-gray-500">
                      Password must be at least 6 characters long.
                    </p>
                  )}
                </div>

                {!isLogin && (
                  <div className="bg-indigo-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-indigo-800 mb-2">
                      Start with a Free Trial
                    </h3>
                    <ul className="text-sm text-indigo-700 space-y-1">
                      <li>✓ 3 days of full access</li>
                      <li>✓ No credit card required for trial</li>
                      <li>✓ Cancel anytime</li>
                    </ul>
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                      isSubmitting
                        ? 'bg-indigo-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      isLogin ? 'Sign in' : 'Start Free Trial'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {!isLogin && (
            <div className="mt-4 text-center text-sm text-gray-500">
              By signing up, you agree to our{' '}
              <Link to="/terms" className="text-indigo-600 hover:text-indigo-800">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-indigo-600 hover:text-indigo-800">
                Privacy Policy
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Login;