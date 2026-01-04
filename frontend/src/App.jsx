import { useState } from 'react'
import {
  UploadCloud,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Activity,
  ShieldCheck,
  Info
} from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs) {
  return twMerge(clsx(inputs))
}

function App() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dragActive, setDragActive] = useState(false)

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
    if (!file) return

    setLoading(true)
    setError(null)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('http://localhost:8000/predict', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Prediction failed')
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">Skin Lesion Analysis</span>
          </div>
          <nav className="hidden md:flex gap-6 text-sm font-medium text-slate-600">
            <a href="#" className="hover:text-blue-600 transition-colors">Home</a>
            <a href="#" className="hover:text-blue-600 transition-colors">About</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Resources</a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-3xl animate-fade-in">

          {/* Hero Text */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
              Advanced Skin Lesion Analysis
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Upload a dermoscopic image to receive an AI-assisted assessment.
              Designed to assist, not replace, professional diagnosis.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-8 md:p-12">

              {/* Upload Zone */}
              <div
                className={cn(
                  "relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ease-in-out cursor-pointer group",
                  dragActive
                    ? "border-blue-500 bg-blue-50 scale-[1.02]"
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
                  <div className="relative group">
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-96 object-contain mx-auto"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setFile(null)
                          setPreview(null)
                          setResult(null)
                        }}
                        className="bg-white text-slate-900 px-6 py-2 rounded-full font-medium hover:bg-slate-100 transition-colors"
                      >
                        Change Image
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-slate-900">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-slate-500 mt-2">
                        SVG, PNG, JPG or GIF (max. 800x400px)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="mt-8">
                <button
                  onClick={handleSubmit}
                  disabled={!file || loading}
                  className={cn(
                    "w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all duration-200",
                    !file || loading
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-blue-500/30 active:scale-[0.98]"
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Analyzing Image...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-6 h-6" />
                      Analyze Lesion
                    </>
                  )}
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700 animate-fade-in">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              {/* Results Section */}
              {result && (
                <div className="mt-8 animate-slide-up">
                  <div className={cn(
                    "p-6 rounded-xl border-l-4 shadow-sm",
                    result.class.includes('Melanocytic')
                      ? "bg-red-50 border-red-500"
                      : "bg-teal-50 border-teal-500"
                  )}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Assessment Result
                        </h3>
                        <div className="flex items-center gap-3">
                          {result.class.includes('Melanocytic') ? (
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                          ) : (
                            <CheckCircle className="w-8 h-8 text-teal-600" />
                          )}
                          <h2 className={cn(
                            "text-3xl font-bold",
                            result.class.includes('Melanocytic') ? "text-red-700" : "text-teal-700"
                          )}>
                            {result.class}
                          </h2>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-500 mb-1">Confidence</p>
                        <p className="text-2xl font-bold text-slate-900">{result.confidence}</p>
                      </div>
                    </div>

                    <div className="h-2 w-full bg-white/50 rounded-full overflow-hidden mb-4">
                      <div
                        className={cn(
                          "h-full transition-all duration-1000 ease-out",
                          result.class.includes('Melanocytic') ? "bg-red-500" : "bg-teal-500"
                        )}
                        style={{ width: result.confidence }}
                      />
                    </div>

                    <div className="flex items-start gap-2 text-sm opacity-90">
                      <Info className="w-4 h-4 mt-0.5 shrink-0" />
                      <p>
                        {result.class.includes('Melanocytic')
                          ? "This result indicates a high probability of Melanocytic features. Please consult a dermatologist immediately for a professional examination."
                          : "This result indicates a lower probability of Melanocytic features. However, any changing or suspicious lesion should be checked by a doctor."
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-slate-500 text-sm mb-4">
            &copy; {new Date().getFullYear()} Skin Lesion Analysis. All rights reserved.
          </p>
          <div className="max-w-2xl mx-auto p-4 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs text-slate-400 leading-relaxed">
              <strong className="text-slate-600">MEDICAL DISCLAIMER:</strong> This tool is for educational and research purposes only.
              It is NOT a diagnostic tool and does not replace professional medical advice, diagnosis, or treatment.
              Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
