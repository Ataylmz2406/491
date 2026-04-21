import React, { useState } from 'react';
import { Activity, AlertCircle, CheckCircle } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ImageUploader from './components/ImageUploader';
import DiagnosisResult from './components/DiagnosisResult';
import PatientHistory from './components/PatientHistory';
import SecondOpinion from './components/SecondOpinion';
import SecondOpinionFeed from './components/SecondOpinionFeed';
import ImageLabelingPage from './components/ImageLabelingPage';
import Login from './components/Login';
import PatientLookup from './components/PatientLookup';
import CaseNotes from './components/CaseNotes';
import Tutorial from './components/Tutorial';
import { CaseProvider, useCaseContext } from './context/CaseContext';
import { clearAccessToken, setAccessToken } from './services/authService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Location mapping for display names
const LOCATION_MAP = {
  'head/neck': 'Head / Neck',
  'upper_extremity': 'Arms / Hands (Upper)',
  'lower_extremity': 'Legs / Feet (Lower)',
  'torso': 'Torso (Chest/Back/Sides)',
  'other_unknown': 'Other / Unknown'
};

function App() {
  // Get case context
  const { state: caseState, dispatch: caseDispatch, resetCurrentCase } = useCaseContext();

  // --- Landing / Navigation State ---
  const [showLanding, setShowLanding] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userType, setUserType] = useState(null); // 'doctor' | 'researcher' | 'personal'
  const [loginData, setLoginData] = useState(null); // store credentials/misc info

  // --- Image State ---
  const [dermFiles, setDermFiles] = useState([]);
  const [dermPreviews, setDermPreviews] = useState([]);
  const [clinFile, setClinFile] = useState(null);
  const [clinPreview, setClinPreview] = useState(null);

  // --- Metadata State ---
  const [patientId, setPatientId] = useState('');
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
  const [pendingTab, setPendingTab] = useState(null); // Tab to redirect after login/guest checkout

  // --- Toast ---
  const [toast, setToast] = useState(null);
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // doctor profile info pulled from login
  const [doctorProfile, setDoctorProfile] = useState({ name: '', info: '' });

  // language toggle (en / tr)
  const [language, setLanguage] = useState('en');

  const translations = {
    en: {
      landingSubtitle: 'Professional AI Skin Diagnostics',
      landingDescription: 'Upload dermoscopic imagery for instant, AI-powered lesion classification powered by Dual-Branch EfficientNetV2.',
      forDoctors: 'For Doctors',
      forResearchers: 'For Researchers',
      personalUse: 'Personal Use',
      forDoctorsDesc: 'Secure clinical workflow & metadata',
      forResearchersDesc: 'Model benchmarking & batch analysis',
      personalUseDesc: 'Quick exploratory screening',
      newConsultation: 'New Consultation Session',
      askSecondOpinion: 'Ask Other Doctors',
      commentDoctors: 'Comment on Other Doctors',
      askSecondOpinionDesc: 'Submit your images and ask for another doctor\'s perspective.',
      commentDoctorsDesc: "Comment on other doctors' second opinion requests.",
      patientHistory: 'Patient History',
      historyMetadata: 'History / Metadata',
      checkImages: 'Ensure images are high-resolution and focused.',
      consultProfessional: 'Please consult a medical professional after use.',
      processing: 'Processing...',
      runDiagnostics: 'Run Diagnostics',
      runDiagnosticsPersonal: 'Analyze my skin',
      dermoscopicExamples: 'Dermoscopic Examples',
      noResult: 'No result yet. Upload images and run diagnosis.',
      noResultPersonal: 'No result yet. Upload images to analyze my skin in personal use.',
      labelAnalysis: 'Ask AI',
      labelAsk: 'Ask other doctors',
      labelFeed: 'Help other doctors',
      labelResearch: 'Help Researchers',
      language: 'Language',
      english: 'English',
      turkish: 'Türkçe'
    },
    tr: {
      landingSubtitle: 'Profesyonel Yapay Zeka Cilt Teşhisi',
      landingDescription: 'Lezyon sınıflandırması için dermatoskopik görüntüler yükleyin; Çift Dallı EfficientNetV2 ile anında sonuç alın.',
      forDoctors: 'Doktorlar için',
      forResearchers: 'Araştırmacılar için',
      personalUse: 'Bireysel Kullanım',
      forDoctorsDesc: 'Güvenli klinik iş akışı ve meta veri',
      forResearchersDesc: 'Model karşılaştırma ve toplu analiz',
      personalUseDesc: 'Hızlı keşif taraması',
      newConsultation: 'Yeni Konsültasyon Oturumu',
      askSecondOpinion: 'Diğer Doktorlara Sor',
      commentDoctors: 'Diğer Doktorlara Yorum Yap',
      askSecondOpinionDesc: 'Resimlerinizi gönderin ve başka bir doktorun perspektifini isteyin.',
      commentDoctorsDesc: 'Diğer doktorların ikinci görüş taleplerine yorum yapın.',
      patientHistory: 'Hasta Geçmişi',
      historyMetadata: 'Geçmiş / Metaveri',
      checkImages: 'Görüntülerin yüksek çözünürlüklü ve odaklı olduğundan emin olun.',
      consultProfessional: 'Kullanımdan sonra lütfen bir sağlık uzmanına danışın.',
      processing: 'İşleniyor...',
      runDiagnostics: 'Teşhise Başla',
      runDiagnosticsPersonal: 'Cildimi analiz et (Bireysel Kullanım)',
      dermoscopicExamples: 'Dermatoskopik Örnekler',
      noResult: 'Sonuç yok. Görüntü yükleyin ve teşhis çalıştırın.',
      noResultPersonal: 'Sonuç yok. Bireysel kullanımda cildimi analiz etmek için görüntü yükleyin.',
      labelAnalysis: 'AI\'ye Sor',
      labelAsk: 'Diğer doktorlara sor',
      labelFeed: 'Diğer doktorlara yardımcı ol',
      labelResearch: 'Araştırmacılara Yardımcı Ol',
      language: 'Dil',
      english: 'English',
      turkish: 'Türkçe'
    }
  };

  const t = translations[language];

  React.useEffect(() => {
    if (selectedTab === 'analysis') {
      setActiveTab('analysis');
    } else if (selectedTab === 'ask') {
      setActiveTab('secondOpinion');
      setSecondOpinionSubTab('ask');
    } else if (selectedTab === 'feed') {
      setActiveTab('secondOpinion');
      setSecondOpinionSubTab('feed');
    } else if (selectedTab === 'help') {
      setActiveTab('help');
    }
  }, [selectedTab]);

  React.useEffect(() => {
    if (userType === 'doctor' && loggedIn) {
      setDoctorProfile({
        name: loginData?.doctorName || loginData?.doctorId || '',
        info: loginData?.hospital || '',
      });
    } else if (userType === 'doctor' && !loggedIn) {
      setDoctorProfile({ name: '', info: '' });
    } else {
      setDoctorProfile({ name: '', info: '' });
    }
  }, [userType, loggedIn, loginData]);

  // Watch for loaded cases from context
  React.useEffect(() => {
    // If a case is loaded with diagnosis data
    if (caseState.currentCase.id && caseState.currentCase.aiPrediction) {
      // Display the diagnosis result
      setResult({
        prediction: caseState.currentCase.aiPrediction,
        confidence_score: caseState.currentCase.confidence || 0,
        details: { top_class: caseState.currentCase.aiPrediction },
        metadata: {},
        grad_cam_url: null,
      });
      
      // Set metadata
      if (caseState.currentCase.patientId) {
        setPatientId(caseState.currentCase.patientId);
      }
      if (caseState.currentCase.lesionLocation) {
        setLocation(caseState.currentCase.lesionLocation);
      }
      
      // Show toast indicating case loaded
      showToast('Case loaded successfully!');
    }
  }, [caseState.currentCase.id]);

  // --- Handlers ---
  const handleUserTypeChoice = (type) => {
    setUserType(type);
    setShowLanding(false);
    setShowLogin(true);
    setLoggedIn(false);
  };

  const handleGuestAccess = () => {
    // Skip login, go straight to the tutorial and then analysis
    setLoggedIn(false);
    clearAccessToken();
    if (pendingTab) {
      setSelectedTab(pendingTab);
      setPendingTab(null);
    }
    setShowLogin(false);
    setShowTutorial(true);
  };

  const handleLoginSuccess = (data) => {
    if (data?.accessToken) {
      setAccessToken(data.accessToken);
    }
    setLoginData(data);
    setLoggedIn(true);
    if (pendingTab) {
      setSelectedTab(pendingTab);
      setPendingTab(null);
    }
    setShowLogin(false);
    setShowTutorial(true);
  };

  const handleTutorialContinue = () => {
    setShowTutorial(false);
  };

  const handleTutorialSkip = () => {
    setShowTutorial(false);
  };

  const handleLoginBack = () => {
    clearAccessToken();
    setUserType(null);
    setShowLanding(true);
    setShowLogin(false);
  };
  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    if (type === 'dermoscopic') {
      // Add to array if less than 4 files
      if (dermFiles.length < 4) {
        setDermFiles([...dermFiles, file]);
        setDermPreviews([...dermPreviews, previewUrl]);
      }
    } else {
      setClinFile(file);
      setClinPreview(previewUrl);
    }
    setResult(null);
  };

  const clearFile = (type, index = null) => {
    if (type === 'dermoscopic') {
      if (index !== null) {
        // Remove specific image by index
        setDermFiles(dermFiles.filter((_, i) => i !== index));
        setDermPreviews(dermPreviews.filter((_, i) => i !== index));
      } else {
        // Clear all dermoscopic images and reset case
        setDermFiles([]);
        setDermPreviews([]);
        resetCurrentCase();
      }
    } else {
      setClinFile(null);
      setClinPreview(null);
    }
    setResult(null);
  };

  const handleSubmit = async () => {
    if (dermFiles.length === 0) {
      setError("At least one dermoscopic image is required for analysis.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      // Append all dermoscopic images
      dermFiles.forEach((file, index) => {
        formData.append(`dermoscopic_image${index === 0 ? '' : '_' + (index + 1)}`, file);
      });
      if (clinFile) formData.append('clinical_image', clinFile);

      // Metadata
      formData.append('lesion_location', location);
      formData.append('diagnosis', diagnosis);

      const response = await fetch(`${API_BASE_URL}/predict`, {
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

  const handleNewSession = () => {
    // Clear results and images to start fresh
    setResult(null);
    setLoading(false);
    setError(null);
    setDermFiles([]);
    setDermPreviews([]);
    setClinFile(null);
    setClinPreview(null);
    setShowClinCheckbox(false);
    resetCurrentCase();
  };

  // watch dermFiles to clear checkbox/clinical when removed
  React.useEffect(() => {
    if (dermFiles.length === 0) {
      // hide checkbox and drop any clinical image
      setShowClinCheckbox(false);
      clearFile('clinical');
    }
  }, [dermFiles]);

  const handleOpenHistory = (metadata = null) => {
    setModalQuestionMetadata(metadata);
    setShowPatientHistory(true);
  };

  // if landing page should be shown, render that instead of the app UI
  if (showLanding) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-surface-darker via-surface-dark to-brand-900 text-white p-6">
        <div className="flex items-center justify-center mb-6 animate-fade-in-up">
          <img src="/logo.png" alt="SUDerm" className="h-[14rem] w-auto object-contain mix-blend-screen invert hue-rotate-180 brightness-110 contrast-125" />
        </div>
        <p className="text-xl text-slate-300 mb-2 font-medium animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
          {t.landingSubtitle}
        </p>
        <p className="text-base text-slate-400 mb-12 max-w-md text-center animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
          {t.landingDescription}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-4xl justify-center animate-fade-in-up" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
          {[
            { label: t.forDoctors, type: 'doctor', desc: t.forDoctorsDesc },
            { label: t.forResearchers, type: 'researcher', desc: t.forResearchersDesc },
            { label: t.personalUse, type: 'personal', desc: t.personalUseDesc }
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
    return <Login language={language} userType={userType} onLoginSuccess={handleLoginSuccess} onBack={handleLoginBack} onGuestAccess={handleGuestAccess} />;
  }

  if (showTutorial && userType) {
    return (
      <Tutorial
        language={language}
        userType={userType}
        onContinue={handleTutorialContinue}
        onSkip={handleTutorialSkip}
        onLanguageChange={setLanguage}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden font-sans text-gray-800 bg-gray-50">
      {!(activeTab === 'secondOpinion' && secondOpinionSubTab === 'feed') && activeTab !== 'help' && (
        <Sidebar
          language={language}
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
              {activeTab === 'analysis' ? (
                <div className="flex items-center mb-1 mt-1">
                   <img src="/logo%20only.png" alt="SUDerm Header Logo" className="h-[4.5rem] w-auto object-contain" />
                </div>
              ) : activeTab === 'help' ? (
                <>
                  <h2 className="text-2xl font-semibold text-gray-800">{t.labelResearch}</h2>
                  <p className="text-sm text-gray-500">Help build training datasets for skin lesion classification</p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-semibold text-gray-800">
                    {secondOpinionSubTab === 'ask' ? t.askSecondOpinion : t.commentDoctors}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {secondOpinionSubTab === 'ask'
                      ? t.askSecondOpinionDesc
                      : t.commentDoctorsDesc}
                  </p>
                </>
              )}
              {loggedIn && loginData && (
                <div className="text-xs text-gray-600 mt-1 max-w-xs">
                  {userType === 'doctor' && (
                    <>
                      <div>Hospital: {loginData.hospital}</div>
                      <div>ID: {loginData.doctorId}</div>
                    </>
                  )}
                  {userType === 'researcher' && <span>Researcher: {loginData.email}</span>}
                  {userType === 'personal' && <span>User: {loginData.email}</span>}
                </div>
              )}
            </div>

            {/* User mode indicator + switcher + Patient History + PatientLookup */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <span>{t.language}:</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="text-sm font-medium text-gray-800 bg-white border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="en">{t.english}</option>
                  <option value="tr">{t.turkish}</option>
                </select>
              </label>
              {userType === 'doctor' && (
                <PatientLookup language={language} currentPatientId={patientId} />
              )}
              {/* tab switcher for doctors */}
              {userType === 'doctor' && (
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <button
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${selectedTab === 'analysis' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => {
                      if (!loggedIn) {
                        setShowLogin(true);
                        return;
                      }
                      setSelectedTab('analysis');
                    }}
                  >
                    {t.labelAnalysis}
                  </button>
                  <button
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${selectedTab === 'ask' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => {
                      if (!loggedIn) {
                        setPendingTab('ask');
                        setShowLogin(true);
                        return;
                      }
                      setSelectedTab('ask');
                    }}
                  >
                    {t.labelAsk}
                  </button>
                  <button
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${selectedTab === 'feed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => {
                      if (!loggedIn) {
                        setPendingTab('feed');
                        setShowLogin(true);
                        return;
                      }
                      setSelectedTab('feed');
                    }}
                  >
                    {t.labelFeed}
                  </button>
                  <button
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${selectedTab === 'help' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => {
                      if (!loggedIn) {
                        setPendingTab('help');
                        setShowLogin(true);
                        return;
                      }
                      setSelectedTab('help');
                    }}
                  >
                    {t.labelResearch}
                  </button>
                </div>
              )}
              {/* New Session button */}
              {activeTab === 'analysis' && result && (
                <button
                  onClick={handleNewSession}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {t.newConsultation}
                </button>
              )}
              <select
                value={userType || ''}
                onChange={(e) => {
                  const type = e.target.value;
                  setUserType(type);
                  // require re-login when switching modes
                  clearAccessToken();
                  setLoggedIn(false);
                  setShowLogin(true);
                }}
                className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow transition-colors"
                aria-label="Switch user mode"
              >
                <option value="doctor">{t.forDoctors}</option>
                <option value="researcher">{t.forResearchers}</option>
                <option value="personal">{t.personalUse}</option>
              </select>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'analysis' ? (
            <div className="max-w-6xl mx-auto">
              <div className="p-8">
                <div className="flex flex-row gap-8 items-start">
                  {/* Left side: Uploads and button - hide after result */}
                  {!result && (
                    <div className="flex flex-col w-full max-w-md gap-4">
                      {/* Patient ID Input (Doctor Mode) */}
                      {userType === 'doctor' && (
                        <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
                          <label className="block text-sm font-bold text-gray-700 mb-2">Patient ID <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={patientId}
                            onChange={(e) => setPatientId(e.target.value)}
                            placeholder="Enter Patient ID (e.g., P001, PAT-2026-001)"
                            className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <p className="text-xs text-gray-500 mt-2">Used for tracking patient history and case organization</p>
                        </div>
                      )}
                      <ImageUploader
                        language={language}
                        dermFiles={dermFiles}
                        dermPreviews={dermPreviews}
                        clinFile={clinFile}
                        clinPreview={clinPreview}
                        handleFileChange={handleFileChange}
                        clearFile={clearFile}
                        showClinical={showClinCheckbox && userType !== 'personal'}
                      />
                      {/* checkbox only visible after a dermoscopic file is selected and not in personal mode */}
                      {dermFiles.length > 0 && userType !== 'personal' && (
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
                          <p>{t.checkImages}</p>
                        </div>
                        {userType === 'personal' && (
                          <p className="text-xs text-red-500 font-medium">
                            {t.consultProfessional}
                          </p>
                        )}
                        <button
                          onClick={handleSubmit}
                          disabled={loading || dermFiles.length === 0}
                          className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-white shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2
                                  ${loading || dermFiles.length === 0 ? 'bg-slate-300 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 hover:shadow-lg active:scale-[0.98] focus:ring-brand-500'}`}
                        >
                          {loading ? <Activity className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />}
                          {loading ? t.processing : (userType === 'personal' ? t.runDiagnosticsPersonal : t.runDiagnostics)}
                        </button>
                        {error && (
                          <div className="p-2 mt-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg animate-fade-in flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" /> {error}
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                  {/* Right side: Diagnosis Result and Notes */}
                  <div className={`${!result ? 'flex-1' : 'w-full'} flex ${result && userType === 'doctor' ? 'flex-row' : 'flex-col'} items-center justify-start gap-4`}>
                    {/* Dermoscopic examples — hidden after results arrive */}
                    {(result || loading) && (
                      <div className={`${result && userType === 'doctor' ? 'flex-1' : 'w-full'}`}>
                        <DiagnosisResult language={language} result={result} location={location} userType={userType} loading={loading} showToast={showToast} patientId={patientId} dermPreviews={dermPreviews} clinPreview={clinPreview} />
                      </div>
                    )}
                    {userType === 'doctor' && result && (
                      <div className="flex-1">
                        <CaseNotes 
                          language={language}
                          visible={true}
                          result={result}
                          patientId={patientId}
                          location={location}
                          locationMap={LOCATION_MAP}
                          onSave={() => showToast('Case saved successfully!')}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'help' ? (
            <ImageLabelingPage
              language={language}
              onViewHistory={handleOpenHistory}
            />
          ) : (
            <div className="max-w-6xl mx-auto p-8">
              {secondOpinionSubTab === 'ask' ? (
                <SecondOpinion
                  language={language}
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
                <SecondOpinionFeed language={language} doctorProfile={doctorProfile} onViewHistory={handleOpenHistory} />
              )}
            </div>
          )}
        </div>

        {/* Patient History Modal */}
        {showPatientHistory && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto modal-panel">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">{t.patientHistory}</h3>
                <button
                  onClick={() => setShowPatientHistory(false)}
                  className="w-10 h-10 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
                  aria-label="Close modal"
                >
                  <span className="text-2xl leading-none">&times;</span>
                </button>
              </div>
              <PatientHistory 
                language={language} 
                userType={userType} 
                questionMetadata={modalQuestionMetadata}
                onCaseSelect={() => setShowPatientHistory(false)}
              />
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

// Wrap App with CaseProvider
function AppWithProvider() {
  return (
    <CaseProvider>
      <App />
    </CaseProvider>
  );
}

export default AppWithProvider;
