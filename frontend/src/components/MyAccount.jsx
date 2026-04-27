import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, MapPin, Activity, LogOut } from 'lucide-react';
import { authFetch } from '../services/authService';
import { friendlyApiMessage } from '../services/apiErrorService';

const CLASS_NAME_MAP = {
  "AKIEC": "Actinic keratosis / intraepidermal carcinoma",
  "BCC": "Basal cell carcinoma",
  "BEN_OTH": "Other benign proliferations, including collision tumors",
  "BKL": "Benign keratinocytic lesion",
  "DF": "Dermatofibroma",
  "INF": "Inflammatory and infectious conditions",
  "MAL_OTH": "Other malignant proliferations, including collision tumors",
  "MEL": "Melanoma",
  "NV": "Melanocytic nevus",
  "SCCKA": "Squamous cell carcinoma / keratoacanthoma",
  "VASC": "Vascular lesions and hemorrhage"
};

export default function MyAccount({ language = 'en', loginData, userType, onBack }) {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const translations = {
    en: {
      myAccount: 'My Account',
      profileInfo: 'Profile Information',
      myAnalyses: 'My Analyses',
      email: 'Email',
      hospital: 'Hospital',
      doctorId: 'Doctor ID',
      name: 'Name',
      noAnalyses: 'No analyses yet',
      loadingAnalyses: 'Loading analyses...',
      error: 'Error loading analyses',
      date: 'Date',
      patient: 'Patient',
      diagnosis: 'Diagnosis',
      confidence: 'Confidence',
      location: 'Location',
      back: 'Back'
    },
    tr: {
      myAccount: 'Hesabım',
      profileInfo: 'Profil Bilgileri',
      myAnalyses: 'Analizlerim',
      email: 'E-posta',
      hospital: 'Hastane',
      doctorId: 'Doktor ID',
      name: 'İsim',
      noAnalyses: 'Henüz analiz yok',
      loadingAnalyses: 'Analizler yükleniyor...',
      error: 'Analizler yüklenirken hata oluştu',
      date: 'Tarih',
      patient: 'Hasta',
      diagnosis: 'Teşhis',
      confidence: 'Güven',
      location: 'Konum',
      back: 'Geri Dön'
    }
  };

  const t = translations[language] || translations.en;
  const analysesErrorText = t.error;

  useEffect(() => {
    const fetchAnalyses = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await authFetch('/doctor/analyses', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch analyses');
        }

        const data = await response.json();
        setAnalyses(Array.isArray(data) ? data : data.analyses || []);
        console.log('Loaded analyses:', Array.isArray(data) ? data : data.analyses || []);
      } catch (err) {
        console.error('Error fetching analyses:', err);
        setError(friendlyApiMessage(err.message, analysesErrorText));
        setAnalyses([]);
      } finally {
        setLoading(false);
      }
    };

    if (userType === 'doctor') {
      fetchAnalyses();
    }
  }, [userType, analysesErrorText]);

  const getDiagnosisLabel = (diagnosis) => {
    if (!diagnosis) return 'Not specified';
    return CLASS_NAME_MAP[diagnosis] || diagnosis;
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US');
    } catch {
      return dateString;
    }
  };

  const getConfidenceColor = (confidence) => {
    // If confidence is > 1, it's already a percentage (0-100)
    const confValue = confidence > 1 ? confidence / 100 : confidence;
    if (confValue >= 0.8) return 'text-green-600';
    if (confValue >= 0.6) return 'text-yellow-600';
    return 'text-orange-600';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t.myAccount}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {userType === 'doctor' ? t.profileInfo : 'Account Overview'}
            </p>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.back}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-8 py-8">
        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{t.profileInfo}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loginData?.email && (
              <div>
                <p className="text-sm font-medium text-gray-600">{t.email}</p>
                <p className="text-lg text-gray-900 pointer-events-none">{loginData.email}</p>
              </div>
            )}
            {userType === 'doctor' && loginData?.hospital && (
              <div>
                <p className="text-sm font-medium text-gray-600">{t.hospital}</p>
                <p className="text-lg text-gray-900 pointer-events-none">{loginData.hospital}</p>
              </div>
            )}
            {userType === 'doctor' && (loginData?.doctor_id || loginData?.doctorId) && (
              <div>
                <p className="text-sm font-medium text-gray-600">{t.doctorId}</p>
                <p className="text-lg text-gray-900 pointer-events-none">{loginData.doctor_id || loginData.doctorId}</p>
              </div>
            )}
            {userType === 'doctor' && (loginData?.full_name || loginData?.doctorName) && (
              <div>
                <p className="text-sm font-medium text-gray-600">{t.name}</p>
                <p className="text-lg text-gray-900 pointer-events-none">{loginData.full_name || loginData.doctorName}</p>
              </div>
            )}
          </div>
        </div>

        {/* Analyses Section (Doctor Only) */}
        {userType === 'doctor' && (
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              {t.myAnalyses}
            </h2>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm">{t.loadingAnalyses}</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-500 text-sm">{t.error}</p>
              </div>
            ) : analyses.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-sm">{t.noAnalyses}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">{t.date}</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">{t.patient}</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">{t.location}</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">{t.diagnosis}</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">{t.confidence}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyses.map((analysis, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {formatDate(analysis.created_at || analysis.date || '')}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          {analysis.patient_id || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {analysis.lesion_location || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          {getDiagnosisLabel(analysis.prediction || analysis.diagnosis || '')}
                        </td>
                        <td className={`py-3 px-4 text-sm font-semibold ${getConfidenceColor(analysis.confidence_score || 0)}`}>
                          {analysis.confidence_score > 1 
                            ? `${(analysis.confidence_score || 0).toFixed(1)}%`
                            : `${((analysis.confidence_score || 0) * 100).toFixed(1)}%`
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Info for Researcher and Personal */}
        {userType !== 'doctor' && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600 text-sm">
              {userType === 'researcher' 
                ? 'Researcher account features coming soon'
                : 'Personal account features'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
