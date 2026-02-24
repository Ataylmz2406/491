import React, { useState } from 'react';
import { Activity, AlertCircle } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ImageUploader from './components/ImageUploader';
import DiagnosisResult from './components/DiagnosisResult';

function App() {
  // --- Image State ---
  const [dermFile, setDermFile] = useState(null);
  const [dermPreview, setDermPreview] = useState(null);
  const [clinFile, setClinFile] = useState(null);
  const [clinPreview, setClinPreview] = useState(null);

  // --- Metadata State ---
  const [location, setLocation] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [imageNotApplicable, setImageNotApplicable] = useState(false);

  // --- App State ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // --- Handlers ---
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

      const response = await fetch('http://localhost:8000/predict', {
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

  return (
    <div className="flex h-screen overflow-hidden font-sans text-gray-800 bg-gray-50">
      <Sidebar
        location={location}
        setLocation={setLocation}
        diagnosis={diagnosis}
        setDiagnosis={setDiagnosis}
        imageNotApplicable={imageNotApplicable}
        setImageNotApplicable={setImageNotApplicable}
      />

      {/* --- Main Content Area --- */}
      <main className="flex-1 overflow-y-auto">
        <header className="px-8 py-6 bg-white border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-800">New Analysis Session</h2>
          <p className="text-sm text-gray-500">Upload imagery to initialize the Dual-Branch EfficientNetV2 model.</p>
        </header>

        <div className="max-w-5xl p-8 mx-auto">
          <ImageUploader
            dermFile={dermFile}
            dermPreview={dermPreview}
            clinFile={clinFile}
            clinPreview={clinPreview}
            handleFileChange={handleFileChange}
            clearFile={clearFile}
          />

          {/* Submit Bar */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <div className="text-xs text-none text-gray-400">
              <p>Ensure images are high-resolution and focused.</p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading || !dermFile}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white shadow-md transition-all
                        ${loading || !dermFile ? 'bg-slate-300 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800 hover:shadow-lg active:scale-95'}
                    `}
            >
              {loading ? <Activity className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />}
              {loading ? 'Processing...' : 'Run Diagnostics'}
            </button>
          </div>

          {error && (
            <div className="p-4 mt-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg animate-fade-in flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          <DiagnosisResult result={result} location={location} />
        </div>
      </main>
    </div>
  );
}

export default App;
