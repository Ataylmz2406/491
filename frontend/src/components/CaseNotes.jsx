import React, { useState } from 'react';
import { Save, X, Copy, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { useCaseContext } from '../context/CaseContext';

export default function CaseNotes({ language = 'en', visible = false, onSave, onDelete, result, patientId, location, locationMap = {} }) {
  const { state, dispatch, saveCurrentCase, deleteCase } = useCaseContext();
  const [showOverrideSelect, setShowOverrideSelect] = useState(false);
  const [showFollowupInput, setShowFollowupInput] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

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
      update: 'Update Case',
      copy: 'Copy Notes',
      clear: 'Clear Notes',
      deleteSaved: 'Delete Saved Case',
      savedSuccess: 'Case saved successfully!',
      deletedSuccess: 'Saved case deleted.',
      saveFailed: 'Case could not be saved. Please try again.',
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
      update: 'Vakayı Güncelle',
      copy: 'Notları Kopyala',
      clear: 'Notları Temizle',
      deleteSaved: 'Kaydedilmiş Vakayı Sil',
      savedSuccess: 'Vaka başarılı şekilde kaydedildi!',
      deletedSuccess: 'Kaydedilmiş vaka silindi.',
      saveFailed: 'Vaka kaydedilemedi. Lütfen tekrar deneyin.',
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
      const saved = await saveCurrentCase();
      setStatusMessage(t.savedSuccess);
      onSave?.(saved);
    } catch (error) {
      setStatusMessage(error?.message || t.saveFailed);
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
    if (window.confirm('Clear notes, tags, follow-up, and diagnosis override?')) {
      dispatch({ type: 'CLEAR_CASE_NOTES' });
      setStatusMessage('');
    }
  };

  const handleDeleteSavedCase = () => {
    if (!state.currentCase.id) return;

    if (window.confirm('Delete this saved case from this browser?')) {
      deleteCase(state.currentCase.id);
      setStatusMessage(t.deletedSuccess);
      onDelete?.();
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <div className="w-full space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-bold text-gray-900">{t.clinicalNotes}</h3>
        <div className="flex flex-wrap gap-2">
          {state.currentCase.id && (
            <button
              onClick={handleDeleteSavedCase}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t.deleteSaved}
            </button>
          )}
          <button
            onClick={handleClearAll}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-600"
          >
            {t.clear}
          </button>
        </div>
      </div>

      {/* Patient ID Display Card */}
      {state.currentCase.patientId && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase text-slate-500">Patient ID</p>
          <p className="text-lg font-bold text-slate-800">{state.currentCase.patientId}</p>
        </div>
      )}

      {/* AI vs Your Diagnosis Comparison */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-gray-600 uppercase font-semibold">{t.aiDiagnosis}</p>
          <p className="text-base font-bold text-slate-800">
            {state.currentCase.aiPrediction 
              ? CLASS_NAMES[state.currentCase.aiPrediction] || state.currentCase.aiPrediction 
              : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {state.currentCase.confidence ? `${state.currentCase.confidence.toFixed(1)}%` : '—'}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs text-gray-600 uppercase font-semibold">{t.yourDiagnosis}</p>
          {state.currentCase.doctorOverride ? (
            <>
              <p className="text-base font-bold text-slate-800">
                {CLASS_NAMES[state.currentCase.doctorOverride] || state.currentCase.doctorOverride}
              </p>
              <button
                onClick={() => handleOverride(null)}
                className="mt-1 text-xs text-brand-700 underline hover:text-brand-800"
              >
                Clear
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowOverrideSelect(!showOverrideSelect)}
              className="mt-1 text-sm font-medium text-brand-700 underline hover:text-brand-800"
            >
              Set Override
            </button>
          )}
        </div>
      </div>

      {/* Override Selection */}
      {showOverrideSelect && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">{t.overrideDiagnosis}</p>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {DIAGNOSIS_OPTIONS.map(option => (
              <button
                key={option.code}
                onClick={() => handleOverride(option.code)}
                className="rounded border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium transition-colors hover:border-brand-400 hover:bg-brand-50"
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
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
            >
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-slate-900"
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
            onKeyDown={(e) => {
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
          {state.currentCase.id ? t.update : t.save}
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

      {statusMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <p>{statusMessage}</p>
        </div>
      )}

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
