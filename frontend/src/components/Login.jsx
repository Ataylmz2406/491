import React, { useState } from 'react';

export default function Login({ userType, onLoginSuccess, onBack }) {
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
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-4 text-center">
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
                  className="mt-1 block w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Doctor ID</label>
                <input
                  type="text"
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border rounded-md"
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
                  className="mt-1 block w-full px-3 py-2 border rounded-md"
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

          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-gray-600 hover:underline"
            >
              &#8592; Back
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Log In
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
