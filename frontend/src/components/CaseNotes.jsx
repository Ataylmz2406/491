import React, { useState } from 'react';
import { Save, X, Copy, AlertCircle, CheckCircle } from 'lucide-react';
import { useCaseContext } from '../context/CaseContext';

export default function CaseNotes({ language = 'en', visible = false, onSave, result, patientId, location, locationMap = {} }) {
  const { state, dispatch, saveCurrentCase } = useCaseContext();
  const [showOverrideSelect, setShowOverrideSelect] = useState(false);
  const [showFollowupInput, setShowFollowupInput] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const texts = {
    en: {
      clinicalNotes: 'Clinical Notes',
      addNotes: 'Add detailed clinical observations, concerns, and follow-up plans...',
      overrideDiagnosis: 'Override AI Diagnosis',
      setFollowup: 'Schedule Follow-up',
      followupDate: 'Follow-up Date',
      tags: 'Case Tags',
      addTag: 'Add tag (urgent, monitored, needs-biopsy, etc.)',
      save: 'Save Case',
      copy: 'Copy Notes',
      clear: 'Clear All',
      savedSuccess: 'Case saved successfully!',
      copiedSuccess: 'Notes copied to clipboard!',
      aiDiagnosis: 'AI Prediction',
      yourDiagnosis: 'Your Assessment',
      confidence: 'Confidence',
      noOverride: 'Keep AI prediction',
      unsavedChanges: 'You have unsaved changes',
    },
    tr: {
      clinicalNotes: 'Klinik Notlar',
      addNotes: 'Detaylı klinik gözlemler, endişeler ve takip planları ekleyin...',
      overrideDiagnosis: 'AI Teşhisini Geçersiz Kıl',
      setFollowup: 'Takip Planla',
      followupDate: 'Takip Tarihi',
      tags: 'Durum Etiketleri',
      addTag: 'Etiket ekle (acil, izlenen, biyopsi-gerekli, vb.)',
      save: 'Vakayı Kaydet',
      copy: 'Notları Kopyala',
      clear: 'Tümünü Temizle',
      savedSuccess: 'Vaka başarılı şekilde kaydedildi!',
      copiedSuccess: 'Notlar panoya kopyalandı!',
      aiDiagnosis: 'AI Tahmini',
      yourDiagnosis: 'Sizin Değerlendirmeniz',
      confidence: 'Güven',
      noOverride: 'AI tahminini sakla',
      unsavedChanges: 'Kaydedilmemiş değişikliklere sahipsiniz',
    },
  };

  const t = texts[language] || texts.en;

  const CLASS_NAMES = {
    'AKIEC': 'Actinic Keratosis',
    'BCC': 'Basal Cell Carcinoma',
    'BEN_OTH': 'Other Benign',
    'BKL': 'Benign Keratinocytic',
    'DF': 'Dermatofibroma',
    'INF': 'Inflammatory',
    'MAL_OTH': 'Other Malignant',
    'MEL': 'Melanoma',
    'NV': 'Melanocytic Nevus',
    'SCCKA': 'Squamous Cell Carcinoma',
    'VASC': 'Vascular Lesions',
  };

  const DIAGNOSIS_OPTIONS = Object.entries(CLASS_NAMES).map(([code, name]) => ({
    code,
    name,
  }));

  const handleNotesChange = (text) => {
    dispatch({ type: 'UPDATE_CLINICAL_NOTES', payload: text });
  };

  const handleOverride = (diagnosisCode) => {
    dispatch({ type: 'SET_DOCTOR_OVERRIDE', payload: diagnosisCode });
    setShowOverrideSelect(false);
  };

  const handleFollowupChange = (date) => {
    dispatch({ type: 'SET_FOLLOWUP_DATE', payload: date });
    setShowFollowupInput(false);
  };

  const handleAddTag = (tag) => {
    if (tag.trim()) {
      dispatch({ type: 'ADD_TAG', payload: tag.trim().toLowerCase() });
    }
  };

  const handleRemoveTag = (tag) => {
    dispatch({ type: 'REMOVE_TAG', payload: tag });
  };

  const handleSave = async () => {
    try {
      await saveCurrentCase();
      onSave?.();
    } catch (error) {
      console.error('Error saving case:', error);
    }
  };

  React.useEffect(() => {
    if (result) {
      dispatch({
        type: 'SET_DIAGNOSIS',
        payload: {
          prediction: result.prediction,
          confidence: result.confidence_score,
        },
      });
    }
  }, [result, dispatch]);

  React.useEffect(() => {
    if (patientId) {
      dispatch({ type: 'SET_PATIENT_ID', payload: patientId });
    }
  }, [patientId, dispatch]);

  React.useEffect(() => {
    if (location) {
      // Convert location code to display name using locationMap
      const displayLocation = locationMap[location] || location;
      dispatch({ type: 'SET_LESION_LOCATION', payload: displayLocation });
    }
  }, [location, dispatch, locationMap]);

  const handleCopy = () => {
    const noteText = `
SUDERM CLINICAL CASE SUMMARY
================================
AI PREDICTION: ${state.currentCase.aiPrediction || 'N/A'} (${state.currentCase.confidence ? state.currentCase.confidence.toFixed(1) : 'N/A'}%)
YOUR ASSESSMENT: ${state.currentCase.doctorOverride || t.noOverride}
FOLLOW-UP: ${state.currentCase.followupDate || 'Not scheduled'}

CLINICAL NOTES:
${state.currentCase.clinicalNotes || 'No notes'}

TAGS: ${state.currentCase.tags.length > 0 ? state.currentCase.tags.join(', ') : 'None'}
    `.trim();

    navigator.clipboard.writeText(noteText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleClearAll = () => {
    if (window.confirm('Clear all notes and overrides?')) {
      dispatch({ type: 'UPDATE_CLINICAL_NOTES', payload: '' });
      dispatch({ type: 'SET_DOCTOR_OVERRIDE', payload: null });
      dispatch({ type: 'SET_FOLLOWUP_DATE', payload: null });
      dispatch({ type: 'RESET_CURRENT_CASE' });
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <div className="w-full bg-white border border-gray-200 rounded-2xl shadow-lg p-6 animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">{t.clinicalNotes}</h3>
        <button
          onClick={handleClearAll}
          className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
        >
          {t.clear}
        </button>
      </div>

      {/* Patient ID Display Card */}
      {state.currentCase.patientId && (
        <div className="p-3 bg-gradient-to-r from-blue-100 to-indigo-100 border-l-4 border-blue-500 rounded-lg">
          <p className="text-xs text-gray-600 uppercase font-bold">Patient ID</p>
          <p className="text-lg font-bold text-blue-700">{state.currentCase.patientId}</p>
        </div>
      )}

      {/* AI vs Your Diagnosis Comparison */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-gray-600 uppercase font-semibold">{t.aiDiagnosis}</p>
          <p className="text-base font-bold text-blue-700">
            {state.currentCase.aiPrediction 
              ? CLASS_NAMES[state.currentCase.aiPrediction] || state.currentCase.aiPrediction 
              : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {state.currentCase.confidence ? `${state.currentCase.confidence.toFixed(1)}%` : '—'}
          </p>
        </div>

        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-xs text-gray-600 uppercase font-semibold">{t.yourDiagnosis}</p>
          {state.currentCase.doctorOverride ? (
            <>
              <p className="text-base font-bold text-purple-700">
                {CLASS_NAMES[state.currentCase.doctorOverride] || state.currentCase.doctorOverride}
              </p>
              <button
                onClick={() => handleOverride(null)}
                className="text-xs text-purple-600 hover:text-purple-800 mt-1 underline"
              >
                Clear
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowOverrideSelect(!showOverrideSelect)}
              className="text-sm text-purple-600 hover:text-purple-800 font-medium mt-1 underline"
            >
              Set Override
            </button>
          )}
        </div>
      </div>

      {/* Override Selection */}
      {showOverrideSelect && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-sm font-semibold text-gray-700 mb-3">{t.overrideDiagnosis}</p>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {DIAGNOSIS_OPTIONS.map(option => (
              <button
                key={option.code}
                onClick={() => handleOverride(option.code)}
                className="px-3 py-2 text-sm font-medium text-left bg-white border border-purple-200 rounded hover:bg-purple-100 hover:border-purple-400 transition-colors"
              >
                {option.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rich Notes Editor */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {t.clinicalNotes}
        </label>
        <textarea
          value={state.currentCase.clinicalNotes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder={t.addNotes}
          rows={6}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
        />
        <p className="text-xs text-gray-500 mt-2">Markdown supported (e.g., **bold**, *italic*)</p>
      </div>

      {/* Follow-up Scheduler */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700">{t.setFollowup}</p>
            {state.currentCase.followupDate ? (
              <p className="text-sm text-amber-700 font-medium mt-1">
                📅 {new Date(state.currentCase.followupDate).toLocaleDateString()}
              </p>
            ) : (
              <p className="text-xs text-gray-600 mt-1">Not scheduled</p>
            )}
          </div>
          <button
            onClick={() => setShowFollowupInput(!showFollowupInput)}
            className="px-3 py-2 text-sm font-medium bg-white border border-amber-300 rounded hover:bg-amber-100 transition-colors"
          >
            {state.currentCase.followupDate ? 'Change' : 'Set'}
          </button>
        </div>
        {showFollowupInput && (
          <div className="mt-3">
            <input
              type="date"
              defaultValue={state.currentCase.followupDate ? state.currentCase.followupDate.split('T')[0] : ''}
              onChange={(e) => handleFollowupChange(new Date(e.target.value).toISOString())}
              className="w-full px-3 py-2 border border-amber-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        )}
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">{t.tags}</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {state.currentCase.tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
            >
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-blue-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        {/* Quick-add buttons for common labels */}
        <div className="mb-3 flex flex-wrap gap-2">
          {['unlabeled', 'urgent', 'monitored', 'needs-biopsy', 'follow-up'].map(predefinedTag => (
            !state.currentCase.tags.includes(predefinedTag) && (
              <button
                key={predefinedTag}
                onClick={() => handleAddTag(predefinedTag)}
                className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 border border-gray-300 transition-colors"
              >
                + {predefinedTag}
              </button>
            )
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={t.addTag}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAddTag(e.target.value);
                e.target.value = '';
              }
            }}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={handleSave}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          {t.save}
        </button>
        <button
          onClick={handleCopy}
          className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-lg font-semibold transition-colors ${
            isCopied
              ? 'bg-green-100 border-green-300 text-green-700'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {isCopied ? (
            <>
              <CheckCircle className="w-4 h-4" />
              {t.copiedSuccess}
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              {t.copy}
            </>
          )}
        </button>
      </div>

      {/* Unsaved Warning */}
      {(state.currentCase.clinicalNotes || state.currentCase.doctorOverride || state.currentCase.followupDate) && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700">{t.unsavedChanges}</p>
        </div>
      )}
    </div>
  );
}
