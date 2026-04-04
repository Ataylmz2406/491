import React, { useState } from 'react';
import { FileText, Calendar, AlertCircle, Search, ChevronRight } from 'lucide-react';
import { useCaseContext } from '../context/CaseContext';

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

export default function PatientHistory({ language = 'en', userType, questionMetadata, onCaseSelect }) {
  const { state: caseState, loadCase, searchPatientCases } = useCaseContext();
  const [searchPatientId, setSearchPatientId] = useState('');
  const [filteredCases, setFilteredCases] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  React.useEffect(() => {
    if (caseState.searchResults && caseState.searchResults.length > 0) {
      setFilteredCases(caseState.searchResults);
    }
  }, [caseState.searchResults]);

  const texts = {
    en: {
      searchPatient: 'Search Patient Cases',
      patientIdLabel: 'Enter Patient ID...',
      search: 'Search',
      noCases: 'No cases found',
      noPreviousCases: 'No previous cases for this patient',
      previousDiagnoses: 'Previous Diagnoses',
      casesFound: 'cases found',
      location: 'Location',
      date: 'Date',
      diagnosis: 'Diagnosis',
      confidence: 'Confidence',
      doctorNotes: 'Doctor Notes',
      status: 'Status',
      treated: 'Treated',
      monitoring: 'Monitoring',
      noAction: 'No Action',
      loading: 'Loading...'
    },
    tr: {
      searchPatient: 'Hasta Vakalarını Ara',
      patientIdLabel: 'Hasta ID\'sini girin...',
      search: 'Ara',
      noCases: 'Vaka bulunamadı',
      noPreviousCases: 'Bu hasta için önceki vaka yok',
      previousDiagnoses: 'Önceki Teşhisler',
      casesFound: 'vaka bulundu',
      location: 'Konum',
      date: 'Tarih',
      diagnosis: 'Teşhis',
      confidence: 'Güven',
      doctorNotes: 'Doktor Notları',
      status: 'Durum',
      treated: 'Tedavi Edildi',
      monitoring: 'İzleme',
      noAction: 'Eylem Yok',
      loading: 'Yükleniyor...'
    }
  };
  const t = texts[language] || texts.en;

  const handleSearch = () => {
    if (searchPatientId.trim()) {
      searchPatientCases(searchPatientId.trim());
      setHasSearched(true);
    }
  };

  const handleCaseClick = (caseId) => {
    loadCase(caseId);
    if (onCaseSelect) {
      onCaseSelect();
    }
  };

  const getStatusColor = (status) => {
    if (status?.toLowerCase().includes('treat')) return 'bg-green-100 text-green-800';
    if (status?.toLowerCase().includes('monitor')) return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getDiagnosisColor = (diagnosis) => {
    if (diagnosis?.toLowerCase().includes('melanoma') || diagnosis?.toLowerCase().includes('carcinoma')) {
      return 'text-red-600';
    }
    return 'text-green-600';
  };

  return (
    <div className="p-8 max-h-full overflow-y-auto">
      {/* Search Section */}
      <div className="mb-8 pb-8 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{t.searchPatient}</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchPatientId}
            onChange={(e) => setSearchPatientId(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t.patientIdLabel}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <button
            onClick={handleSearch}
            className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium flex items-center gap-2 whitespace-nowrap"
          >
            <Search className="w-4 h-4" />
            {t.search}
          </button>
        </div>
      </div>

      {/* Cases List */}
      {!hasSearched ? (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">{t.patientIdLabel}</p>
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-amber-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">{t.noPreviousCases}</p>
          {searchPatientId && <p className="text-sm text-gray-500 mt-1">Patient ID: {searchPatientId}</p>}
        </div>
      ) : (
        <div>
          {/* Patient Header */}
          <div className="mb-8 pb-8 border-b border-gray-200">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Patient Name</p>
                <p className="text-xl font-bold text-gray-900">—</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Patient ID</p>
                <p className="text-xl font-bold text-gray-900">{searchPatientId}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Date of Birth</p>
                <p className="text-xl font-bold text-gray-900">—</p>
              </div>
            </div>
          </div>

          {/* Previous Diagnoses */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {t.previousDiagnoses} ({filteredCases.length})
            </h3>
            <div className="space-y-3">
              {filteredCases.map((caseItem) => {
                const getDiagnosisName = (abbr) => {
                  if (!abbr) return 'Unknown';
                  return CLASS_NAME_MAP[abbr] || abbr;
                };

                const isMalignant = (diagnosis) => {
                  if (!diagnosis) return false;
                  const lower = diagnosis.toLowerCase();
                  return lower.includes('melanoma') || lower.includes('carcinoma');
                };

                return (
                  <button
                    key={caseItem.id}
                    onClick={() => handleCaseClick(caseItem.id)}
                    className="w-full p-4 border border-gray-200 rounded-lg hover:border-teal-300 hover:bg-teal-50 transition-all text-left group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <p className={`text-lg font-bold ${isMalignant(caseItem.aiPrediction) ? 'text-red-600' : 'text-green-600'}`}>
                            {getDiagnosisName(caseItem.aiPrediction)}
                          </p>
                          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            {t.treated}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <p className="text-gray-600">
                            <span className="font-medium">Location:</span> {caseItem.lesionLocation || 'Not specified'}
                          </p>
                          <div className="flex items-center gap-2 text-gray-600">
                            <Calendar className="w-4 h-4" />
                            {new Date(caseItem.savedAt).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t.confidence}</p>
                        <p className="text-2xl font-bold text-teal-600">{caseItem.confidence ? caseItem.confidence.toFixed(1) : 'N/A'}%</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
