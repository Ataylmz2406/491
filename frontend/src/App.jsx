import React, { useState } from 'react';
import { Activity, AlertCircle, CheckCircle } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ImageUploader from './components/ImageUploader';
import DiagnosisResult from './components/DiagnosisResult';
import PatientHistory from './components/PatientHistory';
import SecondOpinion from './components/SecondOpinion';
import SecondOpinionFeed from './components/SecondOpinionFeed';
import Login from './components/Login';

function App() {
  // --- Landing / Navigation State ---
  const [showLanding, setShowLanding] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userType, setUserType] = useState(null); // 'doctor' | 'researcher' | 'personal'
  const [loginData, setLoginData] = useState(null); // store credentials/misc info

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

  // --- Clinical checkbox state ---
  const [showClinCheckbox, setShowClinCheckbox] = useState(false);

  // --- App State ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [showPatientHistory, setShowPatientHistory] = useState(false);
  const [modalQuestionMetadata, setModalQuestionMetadata] = useState(null);
  const [activeTab, setActiveTab] = useState('analysis'); // or 'secondOpinion'
  const [secondOpinionSubTab, setSecondOpinionSubTab] = useState('ask'); // 'ask' or 'feed'
  const [selectedTab, setSelectedTab] = useState('analysis'); // 'analysis', 'ask', 'feed'

  // --- Toast ---
  const [toast, setToast] = useState(null);
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // doctor profile info pulled from login
  const [doctorProfile, setDoctorProfile] = useState({ name: '', info: '' });

  React.useEffect(() => {
    if (selectedTab === 'analysis') {
      setActiveTab('analysis');
    } else if (selectedTab === 'ask') {
      setActiveTab('secondOpinion');
      setSecondOpinionSubTab('ask');
    } else if (selectedTab === 'feed') {
      setActiveTab('secondOpinion');
      setSecondOpinionSubTab('feed');
    }
  }, [selectedTab]);

  React.useEffect(() => {
    if (userType === 'doctor' && loggedIn) {
      setDoctorProfile({ name: 'Dr. Alice Example', info: 'Dermatology Dept.' });
    } else if (userType === 'doctor' && !loggedIn) {
      setDoctorProfile({ name: 'Anonymous', info: 'Anonymous' });
    } else {
      setDoctorProfile({ name: '', info: '' });
    }
  }, [userType, loggedIn]);

  // --- Handlers ---
  const handleUserTypeChoice = (type) => {
    setUserType(type);
    setShowLanding(false);
    setShowLogin(true);
    setLoggedIn(false);
  };

  const handleGuestAccess = () => {
    // Skip login, go straight to analysis
    setLoggedIn(false);
    setShowLogin(false);
  };

  const handleLoginSuccess = (data) => {
    setLoginData(data);
    setLoggedIn(true);
    setShowLogin(false);
  };

  const handleLoginBack = () => {
    setUserType(null);
    setShowLanding(true);
    setShowLogin(false);
  };
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

  // watch dermFile to clear checkbox/clinical when removed
  React.useEffect(() => {
    if (!dermFile) {
      // hide checkbox and drop any clinical image
      setShowClinCheckbox(false);
      clearFile('clinical');
    }
  }, [dermFile]);

  const handleOpenHistory = (metadata = null) => {
    setModalQuestionMetadata(metadata);
    setShowPatientHistory(true);
  };

  // if landing page should be shown, render that instead of the app UI
  if (showLanding) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-surface-darker via-surface-dark to-brand-900 text-white p-6">
        <div className="flex items-center gap-3 mb-4 animate-fade-in-up">
          <Activity className="w-12 h-12 text-brand-400" />
          <h1 className="text-5xl font-bold tracking-tight">SUDerm</h1>
        </div>
        <p className="text-xl text-slate-300 mb-2 font-medium animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
          Professional AI Skin Diagnostics
        </p>
        <p className="text-base text-slate-400 mb-12 max-w-md text-center animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
          Upload dermoscopic imagery for instant, AI-powered lesion classification
          powered by Dual-Branch EfficientNetV2.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-4xl justify-center animate-fade-in-up" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
          {[
            { label: 'For Doctors', type: 'doctor', desc: 'Secure clinical workflow & metadata' },
            { label: 'For Researchers', type: 'researcher', desc: 'Model benchmarking & batch analysis' },
            { label: 'Personal Use', type: 'personal', desc: 'Quick exploratory screening' }
          ].map(({ label, type, desc }) => (
            <button
              key={type}
              onClick={() => handleUserTypeChoice(type)}
              className="group flex flex-col items-center text-center p-6 sm:px-8 sm:py-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl hover:bg-brand-500/20 hover:border-brand-400/40 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-500 hover:scale-[1.03] hover:shadow-2xl flex-1 max-w-sm"
            >
              <span className="block text-xl font-semibold mb-2">{label}</span>
              <span className="block text-sm text-slate-400 group-hover:text-brand-300 transition-colors">
                {desc}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // show login form if required
  if (showLogin && userType) {
    return <Login userType={userType} onLoginSuccess={handleLoginSuccess} onBack={handleLoginBack} onGuestAccess={handleGuestAccess} />;
  }

  return (
    <div className="flex h-screen overflow-hidden font-sans text-gray-800 bg-gray-50">
      {!(activeTab === 'secondOpinion' && secondOpinionSubTab === 'feed') && (
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
          onLogoClick={() => setActiveTab('analysis')}
        />
      )}

      {/* --- Main Content Area --- */}
      <main className={`${activeTab === 'secondOpinion' && secondOpinionSubTab === 'feed' ? 'flex-1' : 'flex-1'} flex flex-col overflow-hidden`}>
        <header className="px-8 py-6 bg-white border-b border-gray-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800">
                {activeTab === 'analysis' ? 'New Analysis Session' : secondOpinionSubTab === 'ask' ? 'Ask for Second Opinion' : 'Comment on Other Doctors'}
              </h2>
              <p className="text-sm text-gray-500">
                {activeTab === 'analysis'
                  ? 'Upload imagery to initialize the Dual-Branch EfficientNetV2 model.'
                  : secondOpinionSubTab === 'ask'
                  ? 'Submit your second-opinion images and comments.'
                  : 'Comment on other doctors\' second opinion requests.'}
              </p>
              {loggedIn && loginData && (
                <p className="text-xs text-gray-600 mt-1">
                  {userType === 'doctor' && (
                    <span>Hospital: {loginData.hospital} | ID: {loginData.doctorId}</span>
                  )}
                  {userType === 'researcher' && <span>Researcher: {loginData.email}</span>}
                  {userType === 'personal' && <span>User: {loginData.email}</span>}
                </p>
              )}
            </div>

            {/* User mode indicator + switcher + Patient History */}
            <div className="flex items-center gap-3">
              {(userType === 'doctor' || userType === 'personal') && (
                <button
                  onClick={() => handleOpenHistory()}
                  className="text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg px-4 py-2 transition"
                  aria-label="View patient history"
                >
                  Patient History
                </button>
              )}
              {/* tab switcher for doctors */}
              {userType === 'doctor' && (
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <button
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${selectedTab === 'analysis' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setSelectedTab('analysis')}
                  >
                    Analysis
                  </button>
                  <select
                    value={selectedTab !== 'analysis' ? selectedTab : 'ask'}
                    onChange={(e) => setSelectedTab(e.target.value)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors outline-none cursor-pointer border-none ${selectedTab !== 'analysis' ? 'bg-white text-gray-900 shadow-sm' : 'bg-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    <option value="ask">Ask for a second opinion</option>
                    <option value="feed">Help other doctors</option>
                  </select>
                </div>
              )}
              <select
                value={userType || ''}
                onChange={(e) => {
                  const type = e.target.value;
                  setUserType(type);
                  // require re-login when switching modes
                  setLoggedIn(false);
                  setShowLogin(true);
                }}
                className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow transition-colors"
                aria-label="Switch user mode"
              >
                <option value="doctor">For Doctors</option>
                <option value="researcher">For Researchers</option>
                <option value="personal">For Personal Use</option>
              </select>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'analysis' ? (
            <div className="max-w-6xl mx-auto">
              <div className="p-8">
                <div className="flex flex-row gap-8 items-start">
                  {/* Left side: Uploads and button */}
                  <div className="flex flex-col w-full max-w-md gap-4">
                    <ImageUploader
                      dermFile={dermFile}
                      dermPreview={dermPreview}
                      clinFile={clinFile}
                      clinPreview={clinPreview}
                      handleFileChange={handleFileChange}
                      clearFile={clearFile}
                      showClinical={showClinCheckbox && userType !== 'personal'}
                    />
                    {/* checkbox only visible after a dermoscopic file is selected and not in personal mode */}
                    {dermFile && userType !== 'personal' && (
                      <label htmlFor="include-clinical-checkbox" className="inline-flex items-center space-x-2 mt-2 cursor-pointer group">
                        <input
                          id="include-clinical-checkbox"
                          type="checkbox"
                          checked={showClinCheckbox}
                          onChange={(e) => {
                            setShowClinCheckbox(e.target.checked);
                            if (!e.target.checked) {
                              clearFile('clinical');
                            }
                          }}
                          className="form-checkbox h-5 w-5 text-brand-600 focus:ring-2 focus:ring-brand-500"
                        />
                        <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Include clinical image</span>
                      </label>
                    )}
                    {/* Submit Bar below uploads */}
                    <div className="flex flex-col gap-2 pt-4">
                      <div className="text-xs text-gray-400">
                        <p>Ensure images are high-resolution and focused.</p>
                      </div>
                      {userType === 'personal' && (
                        <p className="text-xs text-red-500 font-medium">
                          Please consult a medical professional after use.
                        </p>
                      )}
                      <button
                        onClick={handleSubmit}
                        disabled={loading || !dermFile}
                        className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-white shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2
                                ${loading || !dermFile ? 'bg-slate-300 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 hover:shadow-lg active:scale-[0.98] focus:ring-brand-500'}`}
                      >
                        {loading ? <Activity className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />}
                        {loading ? 'Processing...' : 'Run Diagnostics'}
                      </button>
                      {error && (
                        <div className="p-2 mt-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg animate-fade-in flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" /> {error}
                        </div>
                      )}
                    </div>

                  </div>
                  {/* Right side: Reference (before results) + Diagnosis Result */}
                  <div className="flex-1 flex flex-col items-center justify-start gap-4">
                    {/* Dermoscopic examples — hidden after results arrive */}
                    {!result && !loading && (
                      <div className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl animate-fade-in-up">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Dermoscopic Examples</p>
                        <img
                          src="/sample_dermoscopic.webp"
                          alt="Dermoscopic examples — (a)(b) benign, (c)(d) malignant"
                          className="w-full rounded-lg object-contain opacity-90 hover:opacity-100 transition-opacity"
                        />
                        <p className="text-[11px] text-gray-400 mt-2 text-center">(a)(b) benign · (c)(d) malignant</p>
                      </div>
                    )}
                    <DiagnosisResult result={result} location={location} userType={userType} loading={loading} showToast={showToast} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto p-8">
              {secondOpinionSubTab === 'ask' ? (
                <SecondOpinion
                  onViewHistory={() => handleOpenHistory({
                    location,
                    diagnosis,
                    ageGroup,
                    sex,
                    skinTone,
                  })}
                  questionMetadata={{
                    location,
                    diagnosis,
                    ageGroup,
                    sex,
                    skinTone,
                  }}
                  doctorProfile={doctorProfile}
                />
              ) : (
                <SecondOpinionFeed doctorProfile={doctorProfile} onViewHistory={handleOpenHistory} />
              )}
            </div>
          )}
        </div>

        {/* Patient History Modal */}
        {showPatientHistory && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto modal-panel">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Patient History</h3>
                <button
                  onClick={() => setShowPatientHistory(false)}
                  className="w-10 h-10 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
                  aria-label="Close modal"
                >
                  <span className="text-2xl leading-none">&times;</span>
                </button>
              </div>
              <PatientHistory userType={userType} questionMetadata={modalQuestionMetadata} />
            </div>
          </div>
        )}
      </main>

      {/* Global Toast Component */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-6 py-4 rounded-xl shadow-2xl text-sm font-medium z-50 flex items-center gap-3 toast-enter">
          <CheckCircle className="w-5 h-5 text-brand-400" />
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
