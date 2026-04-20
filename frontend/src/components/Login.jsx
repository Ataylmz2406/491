import React, { useState } from 'react';
import { authLogin } from '../services/authService';

export default function Login({ language = 'en', userType, onLoginSuccess, onBack, onGuestAccess }) {
  // fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hospital, setHospital] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const translations = {
    en: {
      doctorLogin: 'Doctor Login',
      researcherLogin: 'Researcher Login',
      personalLogin: 'Personal Use Login',
      hospitalName: 'Hospital Name',
      doctorId: 'Doctor ID',
      password: 'Password',
      email: 'Email',
      back: '← Back',
      login: 'Log In',
      continueAsGuest: 'Continue as Guest'
      ,loginFailed: 'Login failed. Please check your credentials.'
    },
    tr: {
      doctorLogin: 'Doktor Girişi',
      researcherLogin: 'Araştırmacı Girişi',
      personalLogin: 'Bireysel Kullanım Girişi',
      hospitalName: 'Hastane Adı',
      doctorId: 'Doktor ID',
      password: 'Şifre',
      email: 'E-posta',
      back: '← Geri',
      login: 'Giriş Yap',
      continueAsGuest: 'Ziyaretçi olarak devam et'
      ,loginFailed: 'Giriş başarısız. Bilgilerinizi kontrol edin.'
    }
  };

  const t = translations[language] || translations.en;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const authPayload = {
        user_type: userType,
        password,
      };

      if (userType === 'doctor') {
        authPayload.hospital = hospital;
        authPayload.doctor_id = doctorId;
      } else if (userType === 'researcher' || userType === 'personal') {
        authPayload.email = email;
      }

      const authResult = await authLogin(authPayload);

      onLoginSuccess({
        userType,
        email,
        hospital,
        doctorId,
        accessToken: authResult.access_token,
        tokenType: authResult.token_type,
        expiresAt: authResult.expires_at,
        displayName: authResult.display_name,
      });
    } catch (err) {
      setError(err.message || t.loginFailed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-brand-50">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        <h2 className="text-2xl font-semibold mb-6 text-center text-slate-800">
          {userType === 'doctor' && t.doctorLogin}
          {userType === 'researcher' && t.researcherLogin}
          {userType === 'personal' && t.personalLogin}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {userType === 'doctor' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t.hospitalName} <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={hospital}
                  onChange={(e) => setHospital(e.target.value)}
                  className="mt-1 block w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t.doctorId} <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  className="mt-1 block w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t.password} <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
            </>
          )}

          {(userType === 'researcher' || userType === 'personal') && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t.email}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t.password}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
            </>
          )}

          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              {t.back}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
            >
              {submitting ? `${t.login}...` : t.login}
            </button>
          </div>
        </form>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {/* Guest access option */}
        <div className="mt-6 pt-6 border-t border-gray-100 text-center">
          <button
            type="button"
            onClick={onGuestAccess}
            className="text-sm text-brand-600 hover:text-brand-800 font-medium transition-colors px-4 py-2 rounded-lg hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            {t.continueAsGuest}
          </button>
        </div>
      </div>
    </div>
  );
}
