import React from 'react';
import { FileText, Calendar, AlertCircle } from 'lucide-react';

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

// Mock patient data
const MOCK_PATIENT = {
  name: 'John Mitchell',
  id: 'P-2024-001847',
  dateOfBirth: '1968-05-15',
  previousDiagnoses: [
    {
      id: 1,
      date: '2024-02-18',
      diagnosis: 'Melanoma (Stage I)',
      confidence: 87.5,
      location: 'Right shoulder',
      status: 'Treated'
    },
    {
      id: 2,
      date: '2023-11-22',
      diagnosis: 'Basal Cell Carcinoma',
      confidence: 92.1,
      location: 'Face',
      status: 'Treated'
    },
    {
      id: 3,
      date: '2023-08-05',
      diagnosis: 'Benign Nevus',
      confidence: 78.3,
      location: 'Left arm',
      status: 'Monitoring'
    },
    {
      id: 4,
      date: '2023-04-10',
      diagnosis: 'Seborrheic Keratosis',
      confidence: 85.6,
      location: 'Chest',
      status: 'No Action'
    }
  ]
};

export default function PatientHistory({ language = 'en', userType, questionMetadata }) {
  const texts = {
    en: {
      patientName: 'Patient Name',
      patientId: 'Patient ID',
      dob: 'Date of Birth',
      questionMetadata: 'Question Metadata',
      location: 'Location',
      diagnosis: 'Diagnosis',
      ageGroup: 'Age Group',
      sex: 'Sex',
      skinTone: 'Skin Tone',
      hypothesis: 'Hypothesis',
      notSpecified: 'Not specified',
      previousDiagnoses: 'Previous Diagnoses',
      confidence: 'Confidence',
      warning: 'This is mock patient data for demonstration purposes. In production, this section would display actual patient records with proper access control and encryption.'
    },
    tr: {
      patientName: 'Hasta Adı',
      patientId: 'Hasta ID',
      dob: 'Doğum Tarihi',
      questionMetadata: 'Soru Metaverisi',
      location: 'Konum',
      diagnosis: 'Teşhis',
      ageGroup: 'Yaş Grubu',
      sex: 'Cinsiyet',
      skinTone: 'Cilt Tonu',
      hypothesis: 'Hipotez',
      notSpecified: 'Belirtilmedi',
      previousDiagnoses: 'Önceki Teşhisler',
      confidence: 'Güven',
      warning: 'Bu, demo amaçlı sahte hasta verileridir. Üretimde, bu bölüm uygun erişim denetimi ve şifreleme ile gerçek hasta kayıtlarını görüntüleyecektir.'
    }
  };
  const t = texts[language] || texts.en;

  const getStatusColor = (status) => {
    switch (status) {
      case 'Treated':
        return 'bg-green-100 text-green-800';
      case 'Monitoring':
        return 'bg-yellow-100 text-yellow-800';
      case 'No Action':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDiagnosisColor = (diagnosis) => {
    if (diagnosis.toLowerCase().includes('melanoma') || diagnosis.toLowerCase().includes('carcinoma')) {
      return 'text-red-600';
    }
    return 'text-green-600';
  };

  return (
    <div className="p-8">
      {/* Patient Information */}
      <div className="mb-8 pb-8 border-b border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t.patientName}</p>
                <p className="text-lg font-bold text-gray-900">{MOCK_PATIENT.name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t.patientId}</p>
                <p className="text-lg font-bold text-gray-900">{MOCK_PATIENT.id}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t.dob}</p>
                <p className="text-lg font-bold text-gray-900">{new Date(MOCK_PATIENT.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
        </div>
      {questionMetadata && (
        <div className="mb-8 pb-8 border-b border-gray-200">
          <h4 className="text-md font-semibold text-gray-800 mb-3">{t.questionMetadata}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
            <div><span className="font-medium">{t.location}:</span> {questionMetadata.location || '—'}</div>
            <div><span className="font-medium">{t.diagnosis}:</span> {questionMetadata.diagnosis || '—'}</div>
            <div><span className="font-medium">{t.ageGroup}:</span> {questionMetadata.ageGroup || '—'}</div>
            <div><span className="font-medium">{t.sex}:</span> {questionMetadata.sex || '—'}</div>
            <div><span className="font-medium">{t.skinTone}:</span> {questionMetadata.skinTone || '—'}</div>
            <div><span className="font-medium">{t.patientId}:</span> {questionMetadata.patientId || '—'}</div>
            <div><span className="font-medium">{t.hypothesis}:</span> {questionMetadata.currentHypothesis ? (CLASS_NAME_MAP ? CLASS_NAME_MAP[questionMetadata.currentHypothesis] || questionMetadata.currentHypothesis : questionMetadata.currentHypothesis) : t.notSpecified}</div>
          </div>
        </div>
      )}

      {/* Previous Diagnoses */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <FileText className="w-5 h-5 text-teal-400" />
          {t.previousDiagnoses} ({MOCK_PATIENT.previousDiagnoses.length})
        </h3>

        <div className="space-y-4">
          {MOCK_PATIENT.previousDiagnoses.map((dx) => (
            <div
              key={dx.id}
              className="p-5 border border-gray-200 rounded-xl hover:shadow-md transition-shadow bg-gray-50"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <p className={`text-lg font-bold ${getDiagnosisColor(dx.diagnosis)}`}>
                      {dx.diagnosis}
                    </p>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getStatusColor(dx.status)}`}>
                      {dx.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    <span className="font-medium">Location:</span> {dx.location}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="w-4 h-4" />
                    {new Date(dx.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <div className="text-right sm:text-left">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t.confidence}</p>
                  <p className="text-xl font-bold text-gray-900">{dx.confidence.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Access Info */}
        {userType === 'personal' && (
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              {t.warning}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
