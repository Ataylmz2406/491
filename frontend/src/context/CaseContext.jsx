import React, { createContext, useReducer, useCallback } from 'react';
import StorageService from '../services/storageService';

export const CaseContext = createContext();

const initialState = {
  // Current case being worked on
  currentCase: {
    id: null,
    patientId: '',
    lesionLocation: '',
    images: [], // Array of file objects
    imagePreviews: [], // Array of preview URLs
    clinicalImage: null,
    clinicalPreview: null,
    aiPrediction: null,
    confidence: null,
    clinicalNotes: '',
    doctorOverride: null,
    followupDate: null,
    tags: [],
  },
  
  // Case history
  recentCases: [],
  patientCases: [],
  searchResults: [],
  
  // UI state
  isLoading: false,
  error: null,
};

function caseReducer(state, action) {
  switch (action.type) {
    // Current case updates
    case 'SET_PATIENT_ID':
      return {
        ...state,
        currentCase: { ...state.currentCase, patientId: action.payload },
      };

    case 'SET_LESION_LOCATION':
      return {
        ...state,
        currentCase: { ...state.currentCase, lesionLocation: action.payload },
      };

    case 'ADD_IMAGES':
      return {
        ...state,
        currentCase: {
          ...state.currentCase,
          images: [...state.currentCase.images, ...action.payload.files],
          imagePreviews: [...state.currentCase.imagePreviews, ...action.payload.previews],
        },
      };

    case 'REMOVE_IMAGE':
      return {
        ...state,
        currentCase: {
          ...state.currentCase,
          images: state.currentCase.images.filter((_, i) => i !== action.payload),
          imagePreviews: state.currentCase.imagePreviews.filter((_, i) => i !== action.payload),
        },
      };

    case 'SET_CLINICAL_IMAGE':
      return {
        ...state,
        currentCase: {
          ...state.currentCase,
          clinicalImage: action.payload.file,
          clinicalPreview: action.payload.preview,
        },
      };

    case 'REMOVE_CLINICAL_IMAGE':
      return {
        ...state,
        currentCase: {
          ...state.currentCase,
          clinicalImage: null,
          clinicalPreview: null,
        },
      };

    case 'SET_DIAGNOSIS':
      return {
        ...state,
        currentCase: {
          ...state.currentCase,
          aiPrediction: action.payload.prediction,
          confidence: action.payload.confidence,
        },
      };

    case 'UPDATE_CLINICAL_NOTES':
      return {
        ...state,
        currentCase: { ...state.currentCase, clinicalNotes: action.payload },
      };

    case 'SET_DOCTOR_OVERRIDE':
      return {
        ...state,
        currentCase: { ...state.currentCase, doctorOverride: action.payload },
      };

    case 'SET_FOLLOWUP_DATE':
      return {
        ...state,
        currentCase: { ...state.currentCase, followupDate: action.payload },
      };

    case 'ADD_TAG':
      return {
        ...state,
        currentCase: {
          ...state.currentCase,
          tags: [...new Set([...state.currentCase.tags, action.payload])],
        },
      };

    case 'REMOVE_TAG':
      return {
        ...state,
        currentCase: {
          ...state.currentCase,
          tags: state.currentCase.tags.filter(t => t !== action.payload),
        },
      };

    case 'RESET_CURRENT_CASE':
      return {
        ...state,
        currentCase: initialState.currentCase,
      };

    // Case history
    case 'SET_RECENT_CASES':
      return {
        ...state,
        recentCases: action.payload,
      };

    case 'SET_PATIENT_CASES':
      return {
        ...state,
        patientCases: action.payload,
      };

    case 'SET_SEARCH_RESULTS':
      return {
        ...state,
        searchResults: action.payload,
      };

    // UI state
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    case 'LOAD_CASE':
      return {
        ...state,
        currentCase: action.payload,
      };

    default:
      return state;
  }
}

export function CaseProvider({ children }) {
  const [state, dispatch] = useReducer(caseReducer, initialState);

  // Case management actions
  const saveCurrentCase = useCallback(() => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const caseToSave = {
        ...state.currentCase,
        // Don't store actual File objects, just metadata
        images: state.currentCase.imagePreviews.map((preview, i) => ({
          name: state.currentCase.images[i]?.name || `Image ${i + 1}`,
          size: state.currentCase.images[i]?.size || 0,
          preview,
        })),
        clinicalImage: state.currentCase.clinicalPreview ? {
          name: state.currentCase.clinicalImage?.name || 'Clinical Image',
          size: state.currentCase.clinicalImage?.size || 0,
          preview: state.currentCase.clinicalPreview,
        } : null,
      };

      const saved = StorageService.saveCase(caseToSave);
      
      dispatch({ type: 'SET_RECENT_CASES', payload: StorageService.getRecentCases() });
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_ERROR', payload: null });
      
      return saved;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      dispatch({ type: 'SET_LOADING', payload: false });
      throw error;
    }
  }, [state.currentCase]);

  const loadAllRecentCases = useCallback(() => {
    const cases = StorageService.getRecentCases();
    dispatch({ type: 'SET_RECENT_CASES', payload: cases });
  }, []);

  const searchPatientCases = useCallback((patientId) => {
    if (!patientId.trim()) {
      dispatch({ type: 'SET_SEARCH_RESULTS', payload: [] });
      return;
    }
    
    try {
      const cases = StorageService.getCasesByPatientId(patientId);
      dispatch({ type: 'SET_PATIENT_CASES', payload: cases });
      dispatch({ type: 'SET_SEARCH_RESULTS', payload: cases });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, []);

  const loadCase = useCallback((caseId) => {
    try {
      const caseData = StorageService.getCase(caseId);
      if (caseData) {
        dispatch({ type: 'LOAD_CASE', payload: caseData });
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, []);

  const deleteCase = useCallback((caseId) => {
    try {
      StorageService.deleteCase(caseId);
      dispatch({ type: 'SET_RECENT_CASES', payload: StorageService.getRecentCases() });
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, []);

  const resetCurrentCase = useCallback(() => {
    dispatch({ type: 'RESET_CURRENT_CASE' });
  }, []);

  const value = {
    // State
    state,
    dispatch,
    
    // Current case actions
    saveCurrentCase,
    resetCurrentCase,
    loadCase,
    deleteCase,
    
    // History actions
    loadAllRecentCases,
    searchPatientCases,
  };

  return (
    <CaseContext.Provider value={value}>
      {children}
    </CaseContext.Provider>
  );
}

export function useCaseContext() {
  const context = React.useContext(CaseContext);
  if (!context) {
    throw new Error('useCaseContext must be used within CaseProvider');
  }
  return context;
}
