import React, { useState } from 'react';
import { Activity, AlertCircle } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ImageUploader from './components/ImageUploader';
import DiagnosisResult from './components/DiagnosisResult';
import PatientHistory from './components/PatientHistory';

function App() {
  // --- Landing / Navigation State ---
  const [showLanding, setShowLanding] = useState(true);
  const [userType, setUserType] = useState(null); // 'doctor' | 'researcher' | 'personal'

  // --- Image State ---
  const [dermFile, setDermFile] = useState(null);
  const [dermPreview, setDermPreview] = useState(null);
  const [clinFile, setClinFile] = useState(null);
  const [clinPreview, setClinPreview] = useState(null);

  // --- Metadata State ---
  const [location, setLocation] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [imageNotApplicable, setImageNotApplicable] = useState(false);
  const [ageGroup, setAgeGroup] = useState('');
  const [sex, setSex] = useState('');
  const [skinTone, setSkinTone] = useState('');

  // --- App State ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [showPatientHistory, setShowPatientHistory] = useState(false);

  // --- Handlers ---
  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    if (type === 'dermoscopic') {
      setDermFile(file);
      setDermPreview(previewUrl);
    } else {
      setClinFile(file);
      setClinPreview(previewUrl);
    }
    setResult(null);
  };

  const clearFile = (type) => {
    if (type === 'dermoscopic') {
      setDermFile(null);
      setDermPreview(null);
    } else {
      setClinFile(null);
      setClinPreview(null);
    }
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!dermFile) {
      setError("Dermoscopic image is required for analysis.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('dermoscopic_image', dermFile);
      if (clinFile) formData.append('clinical_image', clinFile);

      // Metadata
      formData.append('lesion_location', location);
      formData.append('diagnosis', diagnosis);

      const response = await fetch('http://127.0.0.1:8000/predict', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMsg = 'Failed to process request';
        try {
          const errData = await response.json();
          errorMsg = errData.detail || errorMsg;
        } catch (e) { }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setResult(data);

    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // if landing page should be shown, render that instead of the app UI
  if (showLanding) {
    return (
      <div className="h-screen flex flex-col items-center justify-center space-y-6 bg-gray-50">
        <h1 className="text-4xl font-bold">Welcome to the Skin Diagnostics Portal</h1>
        <p className="text-lg text-gray-600">Please choose an option to continue:</p>
        <div className="flex flex-col sm:flex-row gap-4">
          {[
            { label: 'For Doctors', type: 'doctor' },
            { label: 'For Researchers', type: 'researcher' },
            { label: 'For Personal Use', type: 'personal' }
          ].map(({ label, type }) => (
            <button
              key={label}
              onClick={() => {
                setUserType(type);
                setShowLanding(false);
              }}
              className="px-8 py-4 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden font-sans text-gray-800 bg-gray-50">
      <Sidebar
        location={location}
        setLocation={setLocation}
        diagnosis={diagnosis}
        setDiagnosis={setDiagnosis}
        imageNotApplicable={imageNotApplicable}
        setImageNotApplicable={setImageNotApplicable}
        showGroundTruth={userType !== 'personal'}
        ageGroup={ageGroup}
        setAgeGroup={setAgeGroup}
        sex={sex}
        setSex={setSex}
        skinTone={skinTone}
        setSkinTone={setSkinTone}
      />

      {/* --- Main Content Area --- */}
      <main className="flex-1 overflow-y-auto">
        <header className="px-8 py-6 bg-white border-b border-gray-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800">New Analysis Session</h2>
              <p className="text-sm text-gray-500">Upload imagery to initialize the Dual-Branch EfficientNetV2 model.</p>
            </div>

            {/* User mode indicator + switcher + Patient History button */}
            <div className="flex items-center gap-3">
              {(userType === 'doctor' || userType === 'personal') && (
                <button
                  onClick={() => setShowPatientHistory(true)}
                  className="text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg px-4 py-2 transition"
                  aria-label="View patient history"
                >
                  Patient History
                </button>
              )}
              <select
                value={userType || ''}
                onChange={(e) => setUserType(e.target.value)}
                className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
                aria-label="Switch user mode"
              >
                <option value="doctor">For Doctors</option>
                <option value="researcher">For Researchers</option>
                <option value="personal">For Personal Use</option>
              </select>
            </div>
          </div>
        </header>

        <div className="max-w-5xl mx-auto">
          <div className="p-8">
            <ImageUploader
              dermFile={dermFile}
              dermPreview={dermPreview}
              clinFile={clinFile}
              clinPreview={clinPreview}
              handleFileChange={handleFileChange}
              clearFile={clearFile}
              showClinical={userType !== 'personal'}
            />

          {/* Submit Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-6 border-t border-gray-200 gap-4">
            <div className="flex items-center gap-4">
              <div className="text-xs text-none text-gray-400">
                <p>Ensure images are high-resolution and focused.</p>
              </div>
              {userType === 'personal' && (
                <p className="text-xs text-red-500 font-medium">
                  Please consult a medical professional after use.
                </p>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading || !dermFile}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white shadow-md transition-all
                        ${loading || !dermFile ? 'bg-slate-300 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800 hover:shadow-lg active:scale-95'}
                    `}
            >
              {loading ? <Activity className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />}
              {loading ? 'Processing...' : 'Run Diagnostics'}
            </button>
          </div>

          {error && (
            <div className="p-4 mt-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg animate-fade-in flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          <DiagnosisResult result={result} location={location} />
          </div>
        </div>

        {/* Patient History Modal */}
        {showPatientHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Patient History</h3>
                <button
                  onClick={() => setShowPatientHistory(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-light"
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>
              <PatientHistory userType={userType} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
