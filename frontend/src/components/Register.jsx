import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle, Lock, Mail, User, Phone, Building } from 'lucide-react';
import { authRegister } from '../services/authService';
import { validatePassword, getPasswordStrength } from '../utils/passwordValidation';

export default function Register({ onSuccess, onSwitchToLogin, onCancel }) {
  const [step, setStep] = useState(1); // 1: User Type, 2: User Info, 3: Credentials
  const [userType, setUserType] = useState(''); // 'doctor' | 'researcher' | 'personal'
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    hospitalName: '',
    doctorId: '',
  });
  const [credentials, setCredentials] = useState({
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [passwordValidation, setPasswordValidation] = useState(null);

  const handlePasswordChange = (e) => {
    const password = e.target.value;
    setCredentials({ ...credentials, password });
    setPasswordValidation(validatePassword(password));
  };

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const getPasswordStrengthBar = () => {
    if (!credentials.password) return null;
    const { strength, label } = getPasswordStrength(credentials.password);
    const colors = {
      0: 'bg-gray-300',
      'Weak': 'bg-red-500',
      'Fair': 'bg-yellow-500',
      'Strong': 'bg-green-500',
    };
    return (
      <div className="mt-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${colors[label] || 'bg-gray-300'} transition-all`}
              style={{ width: `${strength}%` }}
            />
          </div>
          <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
      </div>
    );
  };

  const handleStep1Continue = () => {
    if (!userType) {
      setError('Please select an account type');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleStep2Continue = () => {
    setError('');
    if (!formData.fullName.trim()) {
      setError('Full name is required');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Valid email is required');
      return;
    }
    if (!formData.phoneNumber.trim()) {
      setError('Phone number is required');
      return;
    }

    if (userType === 'doctor') {
      if (!formData.hospitalName.trim()) {
        setError('Hospital name is required');
        return;
      }
      if (!formData.doctorId.trim()) {
        setError('Doctor ID is required');
        return;
      }
    }

    setStep(3);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!credentials.password) {
      setError('Password is required');
      return;
    }

    const passwordCheck = validatePassword(credentials.password);
    if (!passwordCheck.isValid) {
      setError(`Password must contain: ${passwordCheck.issues.join(', ')}`);
      return;
    }

    if (credentials.password !== credentials.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        user_type: userType,
        email: formData.email.toLowerCase(),
        full_name: formData.fullName,
        phone_number: formData.phoneNumber,
        password: credentials.password,
        confirm_password: credentials.confirmPassword,
      };

      if (userType === 'doctor') {
        payload.hospital = formData.hospitalName;
        payload.doctor_id = formData.doctorId;
      }

      const result = await authRegister(payload);
      onSuccess(result);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 1: Choose User Type
  if (step === 1) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
            <h1 className="text-3xl font-bold text-center text-slate-800 mb-2">Create Account</h1>
            <p className="text-center text-gray-600 mb-8">Choose your account type to get started</p>

            <div className="space-y-4 mb-8">
              {['doctor', 'researcher', 'personal'].map((type) => (
                <button
                  key={type}
                  onClick={() => setUserType(type)}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left font-medium capitalize ${
                    userType === type
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-700 hover:border-brand-300'
                  }`}
                >
                  {type === 'doctor' && '👨‍⚕️ Doctor Account'}
                  {type === 'researcher' && '🔬 Researcher Account'}
                  {type === 'personal' && '👤 Personal Account'}
                </button>
              ))}
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleStep1Continue}
                disabled={!userType}
                className="flex-1 rounded-lg bg-brand-600 px-4 py-3 font-medium text-white transition hover:bg-brand-700 disabled:bg-slate-400"
              >
                Continue
              </button>
            </div>

            <p className="text-center text-sm text-gray-600 mt-6">
              Already have an account?{' '}
              <button onClick={onSwitchToLogin} className="font-medium text-brand-700 hover:text-brand-800">
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Personal Information
  if (step === 2) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
            <div className="mb-8">
              <button
                onClick={() => setStep(1)}
                className="text-sm text-gray-600 hover:text-gray-800 mb-4"
              >
                ← Back
              </button>
              <h1 className="text-3xl font-bold text-slate-800">Your Information</h1>
              <p className="text-gray-600 text-sm mt-2">Step 2 of 3</p>
            </div>

            <form className="space-y-4 mb-6">
              {/* Full Name */}
              <div>
                <label htmlFor="register-full-name" className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-2" />
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="register-full-name"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none transition focus:border-transparent focus:ring-2 focus:ring-brand-500"
                  placeholder="John Smith"
                  autoComplete="name"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="register-email" className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="register-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none transition focus:border-transparent focus:ring-2 focus:ring-brand-500"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label htmlFor="register-phone-number" className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-2" />
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  id="register-phone-number"
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none transition focus:border-transparent focus:ring-2 focus:ring-brand-500"
                  placeholder="+1 (555) 123-4567"
                  autoComplete="tel"
                />
              </div>

              {/* Doctor-specific fields */}
              {userType === 'doctor' && (
                <>
                  <div>
                    <label htmlFor="register-hospital-name" className="block text-sm font-medium text-gray-700 mb-2">
                      <Building className="w-4 h-4 inline mr-2" />
                      Hospital/Organization <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="register-hospital-name"
                      type="text"
                      value={formData.hospitalName}
                      onChange={(e) => handleInputChange('hospitalName', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none transition focus:border-transparent focus:ring-2 focus:ring-brand-500"
                      placeholder="Medical Center Name"
                      autoComplete="organization"
                    />
                  </div>

                  <div>
                    <label htmlFor="register-doctor-id" className="block text-sm font-medium text-gray-700 mb-2">
                      Doctor ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="register-doctor-id"
                      type="text"
                      value={formData.doctorId}
                      onChange={(e) => handleInputChange('doctorId', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none transition focus:border-transparent focus:ring-2 focus:ring-brand-500"
                      placeholder="MD12345"
                    />
                  </div>
                </>
              )}
            </form>

            {error && (
              <div className="mb-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 px-4 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition"
              >
                Back
              </button>
              <button
                onClick={handleStep2Continue}
                className="flex-1 rounded-lg bg-brand-600 px-4 py-3 font-medium text-white transition hover:bg-brand-700"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Credentials
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="mb-8">
            <button
              onClick={() => setStep(2)}
              className="text-sm text-gray-600 hover:text-gray-800 mb-4"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-bold text-slate-800">Create Password</h1>
            <p className="text-gray-600 text-sm mt-2">Step 3 of 3</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            {/* Password */}
            <div>
              <label htmlFor="register-password" className="block text-sm font-medium text-gray-700 mb-2">
                <Lock className="w-4 h-4 inline mr-2" />
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  value={credentials.password}
                  onChange={handlePasswordChange}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 pr-12 outline-none transition focus:border-transparent focus:ring-2 focus:ring-brand-500"
                  placeholder="Enter a strong password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {/* Password Strength Bar */}
              {getPasswordStrengthBar()}

              {/* Password Requirements */}
              {credentials.password && passwordValidation && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">Password Requirements:</p>
                  <div className="space-y-1.5">
                    {[
                      { met: credentials.password.length >= 6, label: 'At least 6 characters' },
                      { met: /[A-Z]/.test(credentials.password), label: 'One uppercase letter (A-Z)' },
                      { met: /[a-z]/.test(credentials.password), label: 'One lowercase letter (a-z)' },
                      { met: /\d/.test(credentials.password), label: 'One number (0-9)' },
                    ].map((req, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        {req.met ? (
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                        <span className={req.met ? 'text-green-700' : 'text-gray-600'}>{req.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="register-confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                <Lock className="w-4 h-4 inline mr-2" />
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="register-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={credentials.confirmPassword}
                  onChange={(e) => setCredentials({ ...credentials, confirmPassword: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 pr-12 outline-none transition focus:border-transparent focus:ring-2 focus:ring-brand-500"
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {credentials.password && credentials.confirmPassword && credentials.password !== credentials.confirmPassword && (
                <div className="mt-2 flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  Passwords do not match
                </div>
              )}
              {credentials.password && credentials.confirmPassword && credentials.password === credentials.confirmPassword && (
                <div className="mt-2 flex items-start gap-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  Passwords match
                </div>
              )}
            </div>
          </form>

          {error && (
            <div className="mb-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 px-4 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !credentials.password || !credentials.confirmPassword}
              className="flex-1 rounded-lg bg-brand-600 px-4 py-3 font-medium text-white transition hover:bg-brand-700 disabled:bg-slate-400"
            >
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>

          <p className="text-center text-sm text-gray-600 mt-6">
            Already have an account?{' '}
            <button onClick={onSwitchToLogin} className="font-medium text-brand-700 hover:text-brand-800">
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
