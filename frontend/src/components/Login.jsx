import React, { useState } from 'react';
import { authLogin, authRegister } from '../services/authService';

export default function Login({ language = 'en', userType, onLoginSuccess, onBack, onGuestAccess }) {
  // fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hospital, setHospital] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

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
      register: 'Register',
      doctorRegister: 'Doctor Registration',
      researcherRegister: 'Researcher Registration',
      personalRegister: 'Personal Registration',
      needAccount: 'Need an account? Register',
      haveAccount: 'Already have an account? Log in',
      continueAsGuest: 'Continue as Guest',
      loginFailed: 'Authentication failed. Please check your credentials.',
      userExists: 'An account with these credentials already exists. Please log in.',
      invalidCredentials: 'Invalid credentials. Please check your details or register.',
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
      register: 'Kayıt Ol',
      doctorRegister: 'Doktor Kaydı',
      researcherRegister: 'Araştırmacı Kaydı',
      personalRegister: 'Bireysel Kayıt',
      needAccount: 'Hesabınız yok mu? Kayıt Ol',
      haveAccount: 'Zaten hesabınız var mı? Giriş Yap',
      continueAsGuest: 'Ziyaretçi olarak devam et',
      loginFailed: 'Kimlik doğrulama başarısız. Bilgilerinizi kontrol edin.',
      userExists: 'Bu kimlik bilgileriyle zaten bir hesap var. Lütfen giriş yapın.',
      invalidCredentials: 'Geçersiz kimlik bilgileri. Bilgilerinizi kontrol edin veya kayıt olun.',
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

      const authPromise = isRegistering 
        ? authRegister(authPayload)
        : authLogin(authPayload);
      const authResult = await authPromise;

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
      // Map HTTP status codes to friendly UI messages
      const status = err?.status || err?.response?.status;
      if (status === 409) {
        setError(t.userExists);
      } else if (status === 401) {
        setError(t.invalidCredentials);
      } else {
        setError(err.message || t.loginFailed);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-brand-50">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        <h2 className="text-2xl font-semibold mb-6 text-center text-slate-800">
          {userType === 'doctor' && (isRegistering ? t.doctorRegister : t.doctorLogin)}
          {userType === 'researcher' && (isRegistering ? t.researcherRegister : t.researcherLogin)}
          {userType === 'personal' && (isRegistering ? t.personalRegister : t.personalLogin)}
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
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onGuestAccess}
                className="px-4 py-2.5 text-brand-600 bg-white border border-brand-600 rounded-lg hover:bg-brand-50 transition-colors font-medium text-sm"
              >
                {t.continueAsGuest}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
              >
                {submitting ? `${isRegistering ? t.register : t.login}...` : (isRegistering ? t.register : t.login)}
              </button>
            </div>
          </div>
          
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
                setPassword('');
                setEmail('');
                setHospital('');
                setDoctorId('');
              }}
              className="text-sm text-brand-600 hover:text-brand-800 font-medium transition-colors"
            >
              {isRegistering ? t.haveAccount : t.needAccount}
            </button>
          </div>
        </form>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

      </div>
    </div>
  );
}
