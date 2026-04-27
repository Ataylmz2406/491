import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { authLogin } from '../services/authService';

export default function Login({ onSuccess, onSwitchToRegister, onCancel, onGuestAccess }) {
  const [userType, setUserType] = useState('doctor'); // 'doctor' | 'researcher' | 'personal'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        user_type: userType,
        email: email.toLowerCase(),
        password,
      };

      const result = await authLogin(payload);

      if (rememberMe) {
        localStorage.setItem('suderm_last_email', email);
        localStorage.setItem('suderm_last_user_type', userType);
      }

      onSuccess(result);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    // For demonstration - you can remove this in production
    setEmail('demo@example.com');
    setPassword('Demo123');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-blue-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-blue-100">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Welcome Back</h1>
            <p className="text-gray-600">Sign in to your account to continue</p>
          </div>

          {/* User Type Selection */}
          <div className="grid grid-cols-3 gap-2 mb-8">
            {[
              { value: 'doctor', label: '👨‍⚕️ Doctor' },
              { value: 'researcher', label: '🔬 Researcher' },
              { value: 'personal', label: '👤 Personal' },
            ].map((type) => (
              <button
                key={type.value}
                onClick={() => setUserType(type.value)}
                className={`py-2 rounded-lg text-sm font-medium transition-all ${
                  userType === type.value
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition pr-12"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 border-gray-300 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="remember" className="ml-2 text-sm text-gray-700 cursor-pointer">
                Remember me
              </label>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium transition shadow-sm"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          {/* Guest Access */}
          <button
            onClick={onGuestAccess}
            className="w-full py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 font-medium transition"
          >
            Continue as Guest
          </button>

          {/* Footer Links */}
          <div className="mt-8 space-y-4 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <button onClick={onSwitchToRegister} className="text-blue-600 hover:text-blue-700 font-medium">
                Create one
              </button>
            </p>
            <button
              onClick={onCancel}
              className="w-full text-sm text-gray-600 hover:text-gray-800 py-2"
            >
              Back to Home
            </button>
          </div>

          {/* Footer Info */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              🔒 Your data is securely encrypted and protected
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-xs text-blue-800 text-center">
            <strong>First time?</strong> Register for a new account to access all features and store your diagnostic history securely.
          </p>
        </div>
      </div>
    </div>
  );
}
