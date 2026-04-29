import React, { useState, useEffect } from 'react';
import { Activity, AlertCircle, CheckCircle, LogOut, Menu, User, X } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ImageUploader from './components/ImageUploader';
import DiagnosisResult from './components/DiagnosisResult';
import PatientHistory from './components/PatientHistory';
import SecondOpinion from './components/SecondOpinion';
import SecondOpinionFeed from './components/SecondOpinionFeed';
import ImageLabelingPage from './components/ImageLabelingPage';
import LoginNew from './components/LoginNew';
import Register from './components/Register';
import PatientLookup from './components/PatientLookup';
import CaseNotes from './components/CaseNotes';
import Tutorial from './components/Tutorial';
import MyAccount from './components/MyAccount';
import { CaseProvider, useCaseContext } from './context/CaseContext';
import { authLogout, authRefresh, clearAccessToken, setAccessToken, getAccessToken } from './services/authService';
import { friendlyApiMessage } from './services/apiErrorService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const MAX_DERMOSCOPIC_IMAGES = 4;
const MAX_ANALYSIS_IMAGE_BYTES = 8 * 1024 * 1024;
const SUPPORTED_ANALYSIS_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const SUPPORTED_MOBILE_IMAGE_TYPES = new Set(['image/heic', 'image/heif']);
const SUPPORTED_ANALYSIS_UPLOAD_TYPES = new Set([...SUPPORTED_ANALYSIS_IMAGE_TYPES, ...SUPPORTED_MOBILE_IMAGE_TYPES]);
const SUPPORTED_ANALYSIS_IMAGE_LABEL = 'JPG, PNG, WebP, HEIC, or HEIF';
const PROTECTED_DOCTOR_TABS = new Set(['ask', 'feed', 'help']);

const getTutorialSeenKey = (type) => `suderm_tutorial_seen_${type || 'guest'}`;

const hasSeenTutorialThisSession = (type) =>
  typeof window !== 'undefined' &&
  window.localStorage.getItem(getTutorialSeenKey(type)) === 'true';

const markTutorialSeenThisSession = (type) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getTutorialSeenKey(type), 'true');
};

const stripAuthTokens = (data = {}) => {
  const profileData = { ...data };
  delete profileData.access_token;
  delete profileData.token_type;
  return profileData;
};

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
  const { state: caseState, resetCurrentCase } = useCaseContext();

  // --- Landing / Navigation State ---
  const [showLanding, setShowLanding] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userType, setUserType] = useState(null); // 'doctor' | 'researcher' | 'personal'
  const [loginData, setLoginData] = useState(null); // store credentials/misc info
  const [showMyAccount, setShowMyAccount] = useState(false); // Show My Account page

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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [authMessage, setAuthMessage] = useState('');

  // --- Toast ---
  const [toast, setToast] = useState(null);
  const showToast = React.useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

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
      researchSubtitle: 'Help build training datasets for skin lesion classification',
      language: 'Language',
      english: 'English',
      turkish: 'Türkçe',
      myAccount: 'My Account',
      signOut: 'Sign Out',
      myAnalyses: 'My Analyses',
      hospital: 'Hospital',
      doctorId: 'ID',
      researcher: 'Researcher',
      user: 'User',
      openFilters: 'Open case details',
      patientId: 'Patient ID',
      patientIdPlaceholder: 'Enter Patient ID (e.g., P001, PAT-2026-001)',
      patientIdHelper: 'Used for tracking patient history and case organization',
      includeClinicalImage: 'Include clinical image',
      onlySupportedImages: `Only ${SUPPORTED_ANALYSIS_IMAGE_LABEL} images are supported.`,
      maxImageSize: 'Each image must be 8 MB or smaller.',
      maxDermoscopicImages: `You can upload up to ${MAX_DERMOSCOPIC_IMAGES} dermoscopic images.`,
      dermoscopicRequired: 'At least one dermoscopic image is required for analysis.',
      patientIdRequired: 'Patient ID is required before running diagnostics.',
      caseSaved: 'Case saved successfully!',
      loginRequiredFeature: 'Please log in as a doctor to access this feature.'
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
      researchSubtitle: 'Cilt lezyonu sınıflandırması için eğitim veri setleri oluşturmaya yardım edin',
      language: 'Dil',
      english: 'English',
      turkish: 'Türkçe',
      myAccount: 'Hesabım',
      signOut: 'Çıkış Yap',
      myAnalyses: 'Analizlerim',
      hospital: 'Hastane',
      doctorId: 'ID',
      researcher: 'Araştırmacı',
      user: 'Kullanıcı',
      openFilters: 'Vaka detaylarını aç',
      patientId: 'Hasta ID',
      patientIdPlaceholder: 'Hasta ID girin (örn. P001, PAT-2026-001)',
      patientIdHelper: 'Hasta geçmişini ve vaka düzenini takip etmek için kullanılır',
      includeClinicalImage: 'Klinik görüntü ekle',
      onlySupportedImages: `Yalnızca ${SUPPORTED_ANALYSIS_IMAGE_LABEL} görüntüleri desteklenir.`,
      maxImageSize: 'Her görüntü 8 MB veya daha küçük olmalıdır.',
      maxDermoscopicImages: `En fazla ${MAX_DERMOSCOPIC_IMAGES} dermatoskopik görüntü yükleyebilirsiniz.`,
      dermoscopicRequired: 'Analiz için en az bir dermatoskopik görüntü gereklidir.',
      patientIdRequired: 'Teşhisi çalıştırmadan önce Hasta ID gereklidir.',
      caseSaved: 'Vaka başarılı şekilde kaydedildi!',
      loginRequiredFeature: 'Bu özelliğe erişmek için doktor olarak giriş yapın.'
    }
  };

  const t = translations[language];

  // --- Check for persisted login on mount ---
  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const token = getAccessToken();
      const storedUserType = localStorage.getItem('suderm_user_type');
      const storedLoginData = localStorage.getItem('suderm_login_data');

      if (!storedUserType || !storedLoginData) return;

      try {
        const parsedData = JSON.parse(storedLoginData);
        let profileData = parsedData;
        let effectiveUserType = storedUserType;

        if (!token) {
          const refreshed = await authRefresh();
          profileData = { ...parsedData, ...stripAuthTokens(refreshed) };
          effectiveUserType = refreshed.user_type || storedUserType;
        }

        if (cancelled) return;
        setUserType(effectiveUserType);
        setLoginData(profileData);
        setLoggedIn(true);
        setShowLanding(false);
        setShowTutorial(!hasSeenTutorialThisSession(effectiveUserType));
        localStorage.setItem('suderm_user_type', effectiveUserType);
        localStorage.setItem('suderm_login_data', JSON.stringify(profileData));
      } catch (e) {
        if (!cancelled) {
          console.error('Failed to restore login state:', e);
          clearAccessToken();
          localStorage.removeItem('suderm_user_type');
          localStorage.removeItem('suderm_login_data');
        }
      }
    };

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

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
        name: loginData?.full_name || loginData?.doctorName || loginData?.doctor_id || loginData?.doctorId || '',
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
  }, [
    caseState.currentCase.aiPrediction,
    caseState.currentCase.confidence,
    caseState.currentCase.id,
    caseState.currentCase.lesionLocation,
    caseState.currentCase.patientId,
    showToast,
  ]);

  // --- Handlers ---
  const handleUserTypeChoice = (type) => {
    setUserType(type);
    setShowLanding(false);
    setShowLogin(true);
    setShowRegister(false);
    setLoggedIn(false);
  };

  const handleSwitchToRegister = () => {
    setShowLogin(false);
    setShowRegister(true);
  };

  const handleSwitchToLogin = () => {
    setShowRegister(false);
    setShowLogin(true);
  };

  const handleGuestAccess = () => {
    if (pendingTab && PROTECTED_DOCTOR_TABS.has(pendingTab)) {
      setSelectedTab('analysis');
      setPendingTab(null);
      setAuthMessage(t.loginRequiredFeature);
      setShowLogin(true);
      setShowRegister(false);
      return;
    }

    setLoggedIn(false);
    clearAccessToken();
    setPendingTab(null);
    setSelectedTab('analysis');
    setShowLogin(false);
    setShowRegister(false);
    setShowTutorial(!hasSeenTutorialThisSession(userType));
  };

  const handleLoginSuccess = (data) => {
    if (data?.access_token) {
      setAccessToken(data.access_token);
    }
    if (data?.user_type) {
      setUserType(data.user_type);
    }
    const profileData = stripAuthTokens(data);
    setLoginData(profileData);
    setLoggedIn(true);
    setAuthMessage('');
    // Persist login data to localStorage
    localStorage.setItem('suderm_user_type', data?.user_type || userType);
    localStorage.setItem('suderm_login_data', JSON.stringify(profileData));
    if (pendingTab) {
      setSelectedTab(pendingTab);
      setPendingTab(null);
    }
    setShowLogin(false);
    setShowRegister(false);
    setShowTutorial(!hasSeenTutorialThisSession(data?.user_type || userType));
  };

  const handleLogout = () => {
    void authLogout();
    localStorage.removeItem('suderm_user_type');
    localStorage.removeItem('suderm_login_data');
    setLoggedIn(false);
    setLoginData(null);
    setUserType(null);
    setShowLanding(true);
    setShowMyAccount(false);
    setShowTutorial(false);
    setPendingTab(null);
    setSelectedTab('analysis');
    setActiveTab('analysis');
    setSecondOpinionSubTab('ask');
    setAuthMessage('');
    showToast('You have been signed out');
  };

  const handleTutorialContinue = () => {
    markTutorialSeenThisSession(userType);
    setShowTutorial(false);
    if (pendingTab) {
      setSelectedTab(pendingTab);
      setPendingTab(null);
    }
  };

  const handleTutorialSkip = () => {
    markTutorialSeenThisSession(userType);
    setShowTutorial(false);
    if (pendingTab) {
      setSelectedTab(pendingTab);
      setPendingTab(null);
    }
  };

  const handleAuthCancel = () => {
    clearAccessToken();
    localStorage.removeItem('suderm_user_type');
    localStorage.removeItem('suderm_login_data');
    setUserType(null);
    setShowLanding(true);
    setShowLogin(false);
    setShowRegister(false);
    setPendingTab(null);
    setSelectedTab('analysis');
    setAuthMessage('');
  };

  const requireDoctorLoginForTab = (tabName) => {
    if (!loggedIn) {
      setPendingTab(tabName);
      setSelectedTab('analysis');
      setAuthMessage(t.loginRequiredFeature);
      setShowLogin(true);
      return false;
    }
    setAuthMessage('');
    return true;
  };

  const isMobileHeicImage = (file) =>
    SUPPORTED_MOBILE_IMAGE_TYPES.has(file.type) || /\.(heic|heif)$/i.test(file.name || '');

  const transformImageFile = (file, transform) =>
    new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const sourceWidth = img.naturalWidth || img.width;
        const sourceHeight = img.naturalHeight || img.height;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Image editing is not available in this browser.'));
          return;
        }

        if (transform === 'crop-square') {
          const side = Math.min(sourceWidth, sourceHeight);
          canvas.width = side;
          canvas.height = side;
          ctx.drawImage(
            img,
            Math.floor((sourceWidth - side) / 2),
            Math.floor((sourceHeight - side) / 2),
            side,
            side,
            0,
            0,
            side,
            side
          );
        } else if (transform === 'normalize-jpeg') {
          canvas.width = sourceWidth;
          canvas.height = sourceHeight;
          ctx.drawImage(img, 0, 0, sourceWidth, sourceHeight);
        } else {
          canvas.width = sourceHeight;
          canvas.height = sourceWidth;
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(img, -sourceWidth / 2, -sourceHeight / 2);
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Image editing failed. Please try another image.'));
              return;
            }
            const suffix = transform === 'normalize-jpeg' ? 'converted' : transform;
            const editedName = file.name.replace(/\.[^.]+$/, `-${suffix}.jpg`);
            resolve(new File([blob], editedName, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          0.92
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Image could not be edited. Please try another image.'));
      };

      img.src = objectUrl;
    });

  const validateImageFiles = async (files, availableSlots) => {
    const accepted = [];
    const messages = [];

    for (const file of files) {
      const isSupportedType = SUPPORTED_ANALYSIS_UPLOAD_TYPES.has(file.type) || isMobileHeicImage(file);
      if (!isSupportedType) {
        messages.push(t.onlySupportedImages);
        continue;
      }

      if (file.size > MAX_ANALYSIS_IMAGE_BYTES) {
        messages.push(t.maxImageSize);
        continue;
      }

      if (isMobileHeicImage(file)) {
        try {
          accepted.push(await transformImageFile(file, 'normalize-jpeg'));
        } catch {
          messages.push('HEIC/HEIF could not be converted in this browser. Please export it as JPG and try again.');
        }
      } else {
        accepted.push(file);
      }
    }

    if (accepted.length > availableSlots) {
      messages.push(t.maxDermoscopicImages);
    }

    return {
      files: accepted.slice(0, availableSlots),
      message: [...new Set(messages)].join(' '),
    };
  };

  const handleFileChange = async (e, type) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    if (type === 'dermoscopic') {
      const availableSlots = Math.max(0, MAX_DERMOSCOPIC_IMAGES - dermFiles.length);
      const validation = await validateImageFiles(selectedFiles, availableSlots);

      if (validation.files.length > 0) {
        setDermFiles((prev) => [...prev, ...validation.files]);
        setDermPreviews((prev) => [
          ...prev,
          ...validation.files.map((file) => URL.createObjectURL(file)),
        ]);
      }

      setError(validation.message || null);
    } else {
      const validation = await validateImageFiles(selectedFiles.slice(0, 1), 1);
      if (validation.files.length > 0) {
        if (clinPreview) URL.revokeObjectURL(clinPreview);
        setClinFile(validation.files[0]);
        setClinPreview(URL.createObjectURL(validation.files[0]));
      }
      setError(validation.message || null);
    }

    e.target.value = '';
    setResult(null);
  };

  const editDermoscopicImage = async (index, transform) => {
    const file = dermFiles[index];
    if (!file) return;

    try {
      const editedFile = await transformImageFile(file, transform);
      const editedPreview = URL.createObjectURL(editedFile);
      URL.revokeObjectURL(dermPreviews[index]);

      setDermFiles((prev) => prev.map((item, itemIndex) => (itemIndex === index ? editedFile : item)));
      setDermPreviews((prev) => prev.map((item, itemIndex) => (itemIndex === index ? editedPreview : item)));
      setResult(null);
      setError(null);
    } catch (err) {
      setError(err.message || 'Image could not be edited. Please try again.');
    }
  };

  const clearFile = (type, index = null) => {
    if (type === 'dermoscopic') {
      if (index !== null) {
        URL.revokeObjectURL(dermPreviews[index]);
        // Remove specific image by index
        setDermFiles(dermFiles.filter((_, i) => i !== index));
        setDermPreviews(dermPreviews.filter((_, i) => i !== index));
      } else {
        // Clear all dermoscopic images and reset case
        dermPreviews.forEach((preview) => URL.revokeObjectURL(preview));
        setDermFiles([]);
        setDermPreviews([]);
        resetCurrentCase();
      }
    } else {
      if (clinPreview) URL.revokeObjectURL(clinPreview);
      setClinFile(null);
      setClinPreview(null);
    }
    setResult(null);
  };

  const handleSubmit = async () => {
    if (dermFiles.length === 0) {
      setError(t.dermoscopicRequired);
      return;
    }

    if (userType === 'doctor' && !patientId.trim()) {
      setError(t.patientIdRequired);
      return;
    }

    // Validate patient ID for doctors
    if (userType === 'doctor' && !patientId.trim()) {
      setError("Patient ID is required for doctors to run analysis.");
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
        } catch {
          // Keep the default message when the response body is not JSON.
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setResult(data);

      // Auto-save diagnosis for doctors
      const accessToken = getAccessToken();
      if (userType === 'doctor' && loggedIn && accessToken) {
        try {
          // Extract confidence_score - it comes as decimal from backend (0-1)
          const confidence = data.confidence_score || 
                           (data.details?.top_prob ? data.details.top_prob / 100 : 0);
          
          const saveResponse = await fetch(`${API_BASE_URL}/doctor/save-analysis`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              patient_id: patientId || 'Unknown',
              prediction: data.prediction || data.details?.top_class || '',
              confidence_score: confidence,
              lesion_location: location || 'Not specified',
              age_group: ageGroup || '',
              sex: sex || '',
              skin_tone: skinTone || '',
            }),
          });

          if (saveResponse.ok) {
            showToast('Diagnosis saved to your account');
          } else {
            console.error('Failed to save analysis:', await saveResponse.text());
          }
        } catch (saveErr) {
          console.error('Error saving diagnosis:', saveErr);
          // Don't fail the entire operation if save fails
        }
      }
    } catch (err) {
      setError(friendlyApiMessage(err.message, 'Analysis could not be completed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleNewSession = () => {
    // Clear results and images to start fresh
    dermPreviews.forEach((preview) => URL.revokeObjectURL(preview));
    if (clinPreview) URL.revokeObjectURL(clinPreview);
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
      setShowClinCheckbox(false);
      if (clinPreview) {
        URL.revokeObjectURL(clinPreview);
        setClinFile(null);
        setClinPreview(null);
      }
    }
  }, [dermFiles.length, clinPreview]);

  const handleOpenHistory = (metadata = null) => {
    setModalQuestionMetadata(metadata);
    setShowPatientHistory(true);
  };

  // if landing page should be shown, render that instead of the app UI
  if (showLanding) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-start overflow-y-auto bg-gradient-to-br from-surface-darker via-surface-dark to-brand-900 px-4 py-8 text-white sm:justify-center sm:px-6 sm:py-10">
        <div className="mb-4 flex items-center justify-center animate-fade-in-up sm:mb-6">
          <img src="/logo.png" alt="SUDerm" className="h-28 w-auto object-contain mix-blend-screen invert hue-rotate-180 brightness-110 contrast-125 sm:h-40 lg:h-56" />
        </div>
        <p className="mb-2 text-center text-lg font-medium text-slate-300 animate-fade-in-up sm:text-xl" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
          {t.landingSubtitle}
        </p>
        <p className="mb-8 max-w-md text-center text-sm text-slate-400 animate-fade-in-up sm:mb-10 sm:text-base" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
          {t.landingDescription}
        </p>

        <div className="flex w-full max-w-4xl flex-col justify-center gap-3 animate-fade-in-up sm:flex-row sm:gap-4" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
          {[
            { label: t.forDoctors, type: 'doctor', desc: t.forDoctorsDesc },
            { label: t.forResearchers, type: 'researcher', desc: t.forResearchersDesc },
            { label: t.personalUse, type: 'personal', desc: t.personalUseDesc }
          ].map(({ label, type, desc }) => (
            <button
              key={type}
              onClick={() => handleUserTypeChoice(type)}
              className="group flex w-full flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:border-brand-400/40 hover:bg-brand-500/20 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 sm:max-w-sm sm:flex-1 sm:px-6 sm:py-5"
            >
              <span className="mb-2 block text-lg font-semibold sm:text-xl">{label}</span>
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
    return (
      <LoginNew
        initialUserType={userType}
        onSuccess={handleLoginSuccess}
        onSwitchToRegister={handleSwitchToRegister}
        onCancel={handleAuthCancel}
        onGuestAccess={handleGuestAccess}
        authMessage={authMessage}
      />
    );
  }

  // show register form if required
  if (showRegister && userType) {
    return (
      <Register
        onSuccess={handleLoginSuccess}
        onSwitchToLogin={handleSwitchToLogin}
        onCancel={handleAuthCancel}
      />
    );
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

  if (showMyAccount && loggedIn) {
    return (
      <MyAccount
        language={language}
        loginData={loginData}
        userType={userType}
        onBack={() => setShowMyAccount(false)}
      />
    );
  }

  const shouldShowSidebar = !(activeTab === 'secondOpinion' && secondOpinionSubTab === 'feed') && activeTab !== 'help';
  const sidebarProps = {
    language,
    location,
    setLocation,
    diagnosis,
    setDiagnosis,
    imageNotApplicable,
    setImageNotApplicable,
    showGroundTruth: userType !== 'personal',
    ageGroup,
    setAgeGroup,
    sex,
    setSex,
    skinTone,
    setSkinTone,
    onLogoClick: () => {
      setSelectedTab('analysis');
      setMobileSidebarOpen(false);
    },
  };
  return (
    <div className="flex h-screen overflow-hidden font-sans text-gray-800 bg-gray-50">
      {shouldShowSidebar && (
        <>
          <div className="hidden h-full shrink-0 lg:block">
            <Sidebar {...sidebarProps} />
          </div>

          {mobileSidebarOpen && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <button
                type="button"
                aria-label="Close case details"
                className="absolute inset-0 bg-slate-950/60"
                onClick={() => setMobileSidebarOpen(false)}
              />
              <div className="relative h-full w-[min(22rem,88vw)] shadow-2xl">
                <button
                  type="button"
                  aria-label="Close case details"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="absolute right-3 top-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </button>
                <Sidebar {...sidebarProps} />
              </div>
            </div>
          )}
        </>
      )}

      {/* --- Main Content Area --- */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              {shouldShowSidebar && (
                <button
                  type="button"
                  aria-label={t.openFilters}
                  onClick={() => setMobileSidebarOpen(true)}
                  className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>
              )}
              <div>
              {activeTab === 'analysis' ? (
                <div className="flex items-center mb-1 mt-1">
                   <img src="/logo%20only.png" alt="SUDerm Header Logo" className="h-[4.5rem] w-auto object-contain" />
                </div>
              ) : activeTab === 'help' ? (
                <>
                  <h2 className="text-2xl font-semibold text-gray-800">{t.labelResearch}</h2>
                  <p className="text-sm text-gray-500">{t.researchSubtitle}</p>
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
                <div className="text-xs text-gray-600 mt-1 max-w-xs pointer-events-none">
                  {userType === 'doctor' && (
                    <>
                      <div>{t.hospital}: {loginData.hospital || 'N/A'}</div>
                      <div>{t.doctorId}: {loginData.doctor_id || loginData.doctorId || 'N/A'}</div>
                    </>
                  )}
                  {userType === 'researcher' && <span>{t.researcher}: {loginData.email}</span>}
                  {userType === 'personal' && <span>{t.user}: {loginData.email}</span>}
                </div>
              )}
              </div>
            </div>

            {/* User mode indicator + switcher + Patient History + PatientLookup */}
            <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <span>{t.language}:</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="en">{t.english}</option>
                  <option value="tr">{t.turkish}</option>
                </select>
              </label>
              {loggedIn && userType === 'doctor' && (
                <PatientLookup language={language} currentPatientId={patientId} />
              )}
              {/* tab switcher for doctors */}
              {userType === 'doctor' && (
                <div className="flex max-w-full flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
                  <button
                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${selectedTab === 'analysis' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => {
                      setSelectedTab('analysis');
                    }}
                  >
                    {t.labelAnalysis}
                  </button>
                  <button
                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${selectedTab === 'ask' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => {
                      if (requireDoctorLoginForTab('ask')) setSelectedTab('ask');
                    }}
                  >
                    {t.labelAsk}
                  </button>
                  <button
                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${selectedTab === 'feed' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => {
                      if (requireDoctorLoginForTab('feed')) setSelectedTab('feed');
                    }}
                  >
                    {t.labelFeed}
                  </button>
                  <button
                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${selectedTab === 'help' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => {
                      if (requireDoctorLoginForTab('help')) setSelectedTab('help');
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
                  className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                  setPendingTab(null);
                  setSelectedTab('analysis');
                  setActiveTab('analysis');
                  setSecondOpinionSubTab('ask');
                  setAuthMessage('');
                  setShowLogin(true);
                }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
                aria-label="Switch user mode"
              >
                <option value="doctor">{t.forDoctors}</option>
                <option value="researcher">{t.forResearchers}</option>
                <option value="personal">{t.personalUse}</option>
              </select>
              {loggedIn && userType === 'doctor' && (
                <div className="flex items-center gap-2 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setShowMyAccount(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <User className="h-4 w-4" />
                    {t.myAccount}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <LogOut className="h-4 w-4" />
                    {t.signOut}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pb-6">
          {activeTab === 'analysis' ? (
            <div className="max-w-6xl mx-auto">
              <div className="p-4 sm:p-6">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
                  {/* Left side: Uploads and button - hide after result */}
                  {!result && (
                    <div className="flex w-full max-w-md flex-col gap-4">
                      {/* Patient ID Input (Doctor Mode) */}
                      {userType === 'doctor' && (
                        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                          <label className="mb-2 block text-sm font-bold text-slate-700">{t.patientId} <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={patientId}
                            onChange={(e) => setPatientId(e.target.value)}
                            placeholder={t.patientIdPlaceholder}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                          <p className="mt-2 text-xs text-slate-500">{t.patientIdHelper}</p>
                        </div>
                      )}
                      <ImageUploader
                        language={language}
                        userType={userType}
                        dermFiles={dermFiles}
                        dermPreviews={dermPreviews}
                        clinFile={clinFile}
                        clinPreview={clinPreview}
                        handleFileChange={handleFileChange}
                        clearFile={clearFile}
                        editDermoscopicImage={editDermoscopicImage}
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
                          <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{t.includeClinicalImage}</span>
                        </label>
                      )}
                      {/* Submit Bar below uploads */}
                      <div className="flex flex-col gap-2 pt-2">
                        <div className="text-xs text-slate-500">
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
                          className={`flex items-center justify-center gap-2 rounded-lg px-6 py-3.5 font-semibold text-white shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2
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
                  <div className={`${!result ? 'flex-1' : 'w-full'} flex ${result && userType === 'doctor' ? 'flex-col xl:flex-row' : 'flex-col'} items-center justify-start gap-4`}>
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
                          onSave={() => showToast(t.caseSaved)}
                          onDelete={handleNewSession}
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
            <div className="mx-auto max-w-6xl p-4 sm:p-6">
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

      {/* Doctor Action Buttons - Bottom Right */}
      {loggedIn && userType === 'doctor' && (
        <div className="fixed bottom-6 right-6 z-40 hidden flex-col gap-2 lg:flex">
          <button
            onClick={() => setShowMyAccount(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-md hover:shadow-lg"
          >
            <User className="w-4 h-4" />
            {t.myAccount}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 shadow-md hover:shadow-lg"
          >
            <LogOut className="w-4 h-4" />
            {t.signOut}
          </button>
        </div>
      )}

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
