import React, { useState, useEffect } from 'react';
import { Search, X, ChevronRight, Calendar, AlertCircle } from 'lucide-react';
import { useCaseContext } from '../context/CaseContext';

export default function PatientLookup({ language = 'en', onCaseSelect, currentPatientId = '' }) {
  const { searchPatientCases, state, loadCase } = useCaseContext();
  const [patientId, setPatientId] = useState(currentPatientId);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  React.useEffect(() => {
    setPatientId(currentPatientId);
  }, [currentPatientId]);

  // Auto-search when modal opens with a patient ID
  React.useEffect(() => {
    if (isOpen && currentPatientId && currentPatientId.trim()) {
      setHasSearched(true);
      searchPatientCases(currentPatientId.trim());
    }
  }, [isOpen, currentPatientId, searchPatientCases]);

  const texts = {
    en: {
      title: 'Patient History',
      searchPlaceholder: 'Enter Patient ID...',
      noCases: 'No cases found. Start a new diagnosis.',
      recentCases: 'Recent Cases',
      viewHistory: 'View Patient History',
      caseDate: 'Date',
      diagnosis: 'Diagnosis',
      confidence: 'Confidence',
      location: 'Location',
      noPreviousCases: 'No previous cases for this patient',
      loadingHistory: 'Loading patient history...',
      casesFound: 'cases found',
    },
    tr: {
      title: 'Hasta Tarihi',
      searchPlaceholder: 'Hasta ID\'sini girin...',
      noCases: 'Hiç vaka bulunamadı. Yeni bir teşhis başlatın.',
      recentCases: 'Son Vakalar',
      viewHistory: 'Hasta Tarihçesini Görüntüle',
      caseDate: 'Tarih',
      diagnosis: 'Teşhis',
      confidence: 'Güven',
      location: 'Konum',
      noPreviousCases: 'Bu hasta için hiç önceki vaka yok',
      loadingHistory: 'Hasta tarihi yükleniyor...',
      casesFound: 'vaka bulundu',
    },
  };

  const t = texts[language] || texts.en;

  const handleSearch = (e) => {
    e.preventDefault();
    if (patientId.trim()) {
      setHasSearched(true);
      searchPatientCases(patientId.trim());
    }
  };

  const handleCaseClick = (caseId) => {
    loadCase(caseId);
    if (onCaseSelect) {
      onCaseSelect(caseId);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    setPatientId('');
    setHasSearched(false);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const searchResults = state.searchResults || [];

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        title={t.viewHistory}
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">{t.viewHistory}</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-2xl max-h-[80vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-brand-50 to-blue-50">
              <h2 className="text-xl font-bold text-gray-900">{t.title}</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Search Form */}
              <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    autoFocus
                  />
                  {patientId && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
                >
                  <Search className="w-4 h-4" />
                </button>
              </form>

              {/* Results */}
              {!hasSearched ? (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">{t.searchPlaceholder}</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-amber-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">{t.noPreviousCases}</p>
                  <p className="text-sm text-gray-500 mt-1">Patient ID: {patientId}</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-3">
                    {searchResults.length} {t.casesFound}
                  </p>
                  <div className="space-y-2">
                    {searchResults.map((caseItem) => (
                      <button
                        key={caseItem.id}
                        onClick={() => handleCaseClick(caseItem.id)}
                        className="w-full p-4 border border-gray-200 rounded-lg hover:border-brand-300 hover:bg-brand-50 transition-all text-left group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                              <p className="text-sm font-semibold text-gray-900">
                                {formatDate(caseItem.savedAt)}
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-xs text-gray-500 uppercase">{t.diagnosis}</p>
                                <p className="font-semibold text-gray-800">
                                  {caseItem.aiPrediction || 'Pending'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">{t.confidence}</p>
                                <p className="font-semibold text-gray-800">
                                  {caseItem.confidence ? `${caseItem.confidence.toFixed(1)}%` : 'N/A'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase">{t.location}</p>
                                <p className="font-semibold text-gray-800">
                                  {caseItem.lesionLocation || 'Not specified'}
                                </p>
                              </div>
                              {caseItem.doctorOverride && (
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Your Assessment</p>
                                  <p className="font-semibold text-blue-600">{caseItem.doctorOverride}</p>
                                </div>
                              )}
                            </div>
                            {caseItem.clinicalNotes && (
                              <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                                {caseItem.clinicalNotes}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-brand-600 shrink-0 ml-2" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
