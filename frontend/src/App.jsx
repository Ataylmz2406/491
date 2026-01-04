import { useState } from 'react'
import {
  UploadCloud,
  Activity,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ShieldCheck,
  Info,
  User,
  MapPin,
  Stethoscope,
  FileText
} from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs) {
  return twMerge(clsx(inputs))
}

const DIAGNOSIS_OPTIONS = [
  "Melanoma",
  "Melanocytic Nevus",
  "Basal Cell Carcinoma",
  "Actinic Keratosis",
  "Benign Keratosis",
  "Dermatofibroma",
  "Vascular Lesion",
  "Squamous Cell Carcinoma",
  "Benign Other",
  "Malignant Other",
  "Image is not applicable / Too small"
]

function App() {
  // State
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dragActive, setDragActive] = useState(false)

  // Medical Form State
  const [patientId, setPatientId] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [lesionLocation, setLesionLocation] = useState('')

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      setFile(droppedFile)
      setPreview(URL.createObjectURL(droppedFile))
      setResult(null)
      setError(null)
    }
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setFile(selectedFile)
      setPreview(URL.createObjectURL(selectedFile))
      setResult(null)
      setError(null)
    }
  }

  const handleSubmit = async () => {
    if (!file) {
      setError("Please upload an image first.")
      return
    }
    if (!diagnosis) {
      setError("Please select a clinical diagnosis (ground truth).")
      return
    }

    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('patient_id', patientId)
    formData.append('diagnosis', diagnosis)
    formData.append('lesion_location', lesionLocation)

    try {
      const response = await fetch('http://localhost:8000/predict', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Prediction failed. Please check server connection.')
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
    setPatientId('')
    setDiagnosis('')
    setLesionLocation('')
    setError(null)
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-700 p-2 rounded-lg shadow-sm">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none">Skin Lesion AI</h1>
              <p className="text-xs text-slate-500 font-medium">Cerrahpaşa Medical Tool</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:block px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold border border-blue-100">
              Doctor Mode
            </div>
            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600">
              <User className="w-5 h-5" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-6 lg:p-8 max-w-7xl mx-auto w-full">

        <div className="grid lg:grid-cols-12 gap-8 h-full">

          {/* Left Column: Image Upload (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-full flex flex-col">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-blue-600" />
                Dermoscopic Image
              </h2>

              <div
                className={cn(
                  "relative flex-grow min-h-[300px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all duration-300 ease-in-out cursor-pointer group bg-slate-50/50",
                  dragActive
                    ? "border-blue-500 bg-blue-50 scale-[1.01]"
                    : "border-slate-300 hover:border-blue-400 hover:bg-slate-50",
                  preview && "border-none p-0 overflow-hidden bg-black"
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => !preview && document.getElementById('fileInput').click()}
              >
                <input
                  type="file"
                  id="fileInput"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />

                {preview ? (
                  <div className="relative w-full h-full group flex items-center justify-center bg-black">
                    <img
                      src={preview}
                      alt="Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setFile(null)
                          setPreview(null)
                          setResult(null)
                        }}
                        className="bg-white text-slate-900 px-6 py-2 rounded-full font-medium hover:bg-slate-100 transition-colors shadow-lg"
                      >
                        Change Image
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 p-8">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform shadow-sm">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-slate-900">
                        Upload Lesion Image
                      </p>
                      <p className="text-slate-500 mt-1 text-sm">
                        Drag & drop or click to browse
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Form & Results (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">

            {/* Clinical Data Form */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                <FileText className="w-5 h-5 text-blue-600" />
                Clinical Data
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Patient ID */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                    <User className="w-4 h-4 text-slate-400" />
                    Patient ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PT-28491"
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-300 text-sm"
                  />
                </div>

                {/* Lesion Location */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    Lesion Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Upper Left Back"
                    value={lesionLocation}
                    onChange={(e) => setLesionLocation(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-300 text-sm"
                  />
                </div>

                {/* Ground Truth Diagnosis - Full Width */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                    <Stethoscope className="w-4 h-4 text-slate-400" />
                    Clinical Diagnosis (Ground Truth) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white text-sm"
                  >
                    <option value="" disabled>Select Diagnosis...</option>
                    {DIAGNOSIS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex gap-4">
                <button
                  onClick={handleSubmit}
                  disabled={!file || loading}
                  className={cn(
                    "flex-1 py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all duration-200 shadow-md",
                    !file || loading
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                      : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-500/25 active:scale-[0.98]"
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing Analysis...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      Analyze & Save Data
                    </>
                  )}
                </button>
                {result && (
                  <button
                    onClick={resetForm}
                    className="px-6 py-3.5 rounded-xl font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    New Patient
                  </button>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3 text-red-700 text-sm animate-fade-in">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}
            </div>

            {/* AI Results Section */}
            {result && (
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-indigo-100 animate-slide-up relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-indigo-900">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  AI Analysis Result
                </h2>

                <div className="flex flex-col md:flex-row gap-8 items-start">

                  <div className="flex-1 w-full">
                    <div className="flex items-center gap-4 mb-2">
                      {result.class.includes('Melanocytic') ? (
                        <div className="p-3 bg-red-100 text-red-600 rounded-full">
                          <AlertTriangle className="w-8 h-8" />
                        </div>
                      ) : (
                        <div className="p-3 bg-teal-100 text-teal-600 rounded-full">
                          <CheckCircle className="w-8 h-8" />
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Predicted Class</p>
                        <h3 className={cn(
                          "text-2xl font-bold",
                          result.class.includes('Melanocytic') ? "text-red-700" : "text-teal-700"
                        )}>
                          {result.class}
                        </h3>
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="flex justify-between text-sm mb-2 font-medium text-slate-600">
                        <span>Confidence Score</span>
                        <span className="text-slate-900 font-bold">{result.confidence}</span>
                      </div>
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all duration-1000 ease-out rounded-full",
                            result.class.includes('Melanocytic') ? "bg-red-500" : "bg-teal-500"
                          )}
                          style={{ width: result.confidence }}
                        />
                      </div>
                    </div>

                    <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-100 text-sm text-slate-600 leading-relaxed flex items-start gap-3">
                      <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                      {result.class.includes('Melanocytic')
                        ? "The model has detected features highly consistent with melanocytic lesions. It is recommended to proceed with standard diagnostic protocols for high-risk lesions."
                        : "The model analysis suggests a lower probability of melanocytic features. However, clinical correlation remains essential."
                      }
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>&copy; {new Date().getFullYear()} Skin Lesion Analysis Tool. Internal Use Only.</p>
          <p className="text-center md:text-right max-w-lg">
            <strong className="text-slate-500">DISCLAIMER:</strong> Not a diagnostic device.
            Decision support system for research purposes.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
