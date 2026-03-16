import React, { useState } from 'react';

export default function Login({ userType, onLoginSuccess, onBack, onGuestAccess }) {
  // fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hospital, setHospital] = useState('');
  const [doctorId, setDoctorId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { userType };

    if (userType === 'doctor') {
      payload.hospital = hospital;
      payload.doctorId = doctorId;
      payload.password = password;
    } else if (userType === 'researcher' || userType === 'personal') {
      payload.email = email;
      payload.password = password;
    }

    // In a real app you'd call an API here. For now we just notify parent.
    onLoginSuccess(payload);
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-brand-50">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        <h2 className="text-2xl font-semibold mb-6 text-center text-slate-800">
          {userType === 'doctor' && 'Doctor Login'}
          {userType === 'researcher' && 'Researcher Login'}
          {userType === 'personal' && 'Personal Use Login'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {userType === 'doctor' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Hospital Name</label>
                <input
                  type="text"
                  value={hospital}
                  onChange={(e) => setHospital(e.target.value)}
                  className="mt-1 block w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Doctor ID</label>
                <input
                  type="text"
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  className="mt-1 block w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
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
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
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
              &larr; Back
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
            >
              Log In
            </button>
          </div>
        </form>

        {/* Guest access option */}
        <div className="mt-6 pt-6 border-t border-gray-100 text-center">
          <button
            type="button"
            onClick={onGuestAccess}
            className="text-sm text-brand-600 hover:text-brand-800 font-medium transition-colors px-4 py-2 rounded-lg hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
