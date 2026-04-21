import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2, CheckCircle, ChevronRight, ChevronLeft, BarChart3 } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Classification class names matching the backend
const CLASS_NAMES = [
  'AKIEC', 'BCC', 'BEN_OTH', 'BKL', 'DF', 'INF',
  'MAL_OTH', 'MEL', 'NV', 'SCCKA', 'VASC'
];

// Class descriptions for doctors
const CLASS_DESCRIPTIONS = {
  'AKIEC': 'Actinic keratosis/Intraepithelial carcinoma',
  'BCC': 'Basal cell carcinoma',
  'BEN_OTH': 'Benign keratosis (other)',
  'BKL': 'Benign keratosis',
  'DF': 'Dermatofibroma',
  'INF': 'Infectious disease',
  'MAL_OTH': 'Malignant neoplasm (other)',
  'MEL': 'Melanoma',
  'NV': 'Nevus',
  'SCCKA': 'Squamous cell carcinoma/Keratoacanthoma',
  'VASC': 'Vascular lesion'
};

export default function ImageLabelingPage({ language = 'en', onViewHistory }) {
  const translations = {
    en: {
      title: ' Researchers: Label Images',
      subtitle: 'Assist in building high-quality training datasets for skin lesion classification',
      loading: 'Loading images...',
      loadingStats: 'Loading statistics...',
      error: 'Error loading images. Please try again.',
      noImages: 'No images found in the dataset.',
      currentImage: 'Image',
      of: 'of',
      classification: 'Classification',
      selectClass: 'Select a classification...',
      confidence: 'Confidence Level',
      veryLow: 'Very Low',
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      veryHigh: 'Very High',
      submit: 'Save Label',
      submitting: 'Saving...',
      next: 'Next Image',
      previous: 'Previous Image',
      labeledSuccessfully: 'Label saved successfully!',
      errorSavingLabel: 'Error saving label. Please try again.',
      progressTitle: 'Labeling Progress',
      totalImages: 'Total Images',
      labeled: 'Labeled',
      unlabeled: 'Unlabeled',
      completion: 'Completion',
      distribution: 'Label Distribution',
      pleaseSelectClass: 'Please select a classification.',
      confirmBeforeSkip: 'You have unsaved changes. Do you want to skip this image?'
    },
    tr: {
      title: 'Araştırmacılara Yardım: Görüntüleri Etiketle',
      subtitle: 'Cilt lezyonu sınıflandırması için yüksek kaliteli eğitim veri setleri oluşturulmasına yardımcı ol',
      loading: 'Görüntüler yükleniyor...',
      loadingStats: 'İstatistikler yükleniyor...',
      error: 'Görüntüler yüklenirken hata oluştu. Lütfen tekrar deneyin.',
      noImages: 'Veri setinde görüntü bulunamadı.',
      currentImage: 'Görüntü',
      of: 'tanesi',
      classification: 'Sınıflandırma',
      selectClass: 'Bir sınıflandırma seçin...',
      confidence: 'Güven Seviyesi',
      veryLow: 'Çok Düşük',
      low: 'Düşük',
      medium: 'Orta',
      high: 'Yüksek',
      veryHigh: 'Çok Yüksek',
      submit: 'Etiketi Kaydet',
      submitting: 'Kaydediliyor...',
      next: 'Sonraki Görüntü',
      previous: 'Önceki Görüntü',
      labeledSuccessfully: 'Etiket başarıyla kaydedildi!',
      errorSavingLabel: 'Etiket kaydedilirken hata oluştu. Lütfen tekrar deneyin.',
      progressTitle: 'Etiketleme İlerlemesi',
      totalImages: 'Toplam Görüntü',
      labeled: 'Etiketlenen',
      unlabeled: 'Etiketlenmeyen',
      completion: 'Tamamlanma',
      distribution: 'Etiket Dağılımı',
      pleaseSelectClass: 'Lütfen bir sınıflandırma seçin.',
      confirmBeforeSkip: 'Kaydedilmemiş değişiklikleriniz var. Bu görüntüyü atlamak istiyor musunuz?'
    }
  };

  const t = translations[language] || translations.en;

  // State
  const [images, setImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [classification, setClassification] = useState('');
  const [confidenceScore, setConfidenceScore] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [toast, setToast] = useState(null);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [currentImageData, setCurrentImageData] = useState(null);
  const [currentImageLoading, setCurrentImageLoading] = useState(false);
  const [currentLabel, setCurrentLabel] = useState(null);

  // Load images
  useEffect(() => {
    const loadImages = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${API_BASE_URL}/mil10k/images`);
        if (!response.ok) {
          throw new Error('Failed to load images');
        }
        const data = await response.json();
        setImages(data);
        if (data.length > 0) {
          setCurrentImageIndex(0);
        }
      } catch (err) {
        setError(err.message);
        console.error('Error loading images:', err);
      } finally {
        setLoading(false);
      }
    };

    loadImages();
  }, []);

  // Load statistics
  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoadingStats(true);
        const response = await fetch(`${API_BASE_URL}/mil10k/labels-stats`);
        if (!response.ok) {
          throw new Error('Failed to load stats');
        }
        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error('Error loading stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };

    loadStats();
  }, []);

  // Load current image data
  useEffect(() => {
    if (images.length === 0) return;

    const currentImage = images[currentImageIndex];
    const loadImageData = async () => {
      try {
        setCurrentImageLoading(true);
        setCurrentImageData(null);
        setCurrentLabel(null);
        setClassification('');
        setConfidenceScore(3);
        setSubmitError(null);

        // Load image data
        const imageResponse = await fetch(
          `${API_BASE_URL}/mil10k/image-data/${currentImage.folder}/${currentImage.filename}`
        );
        if (!imageResponse.ok) {
          throw new Error('Failed to load image');
        }
        const imageData = await imageResponse.json();
        setCurrentImageData(imageData);

        // Try to load existing label
        try {
          const labelResponse = await fetch(
            `${API_BASE_URL}/mil10k/labels/${currentImage.folder}/${currentImage.filename}`
          );
          if (labelResponse.ok) {
            const labelData = await labelResponse.json();
            if (labelData) {
              setCurrentLabel(labelData);
              setClassification(labelData.classification);
              setConfidenceScore(labelData.confidence_score);
            }
          }
        } catch (err) {
          // Label might not exist yet, that's fine
        }
      } catch (err) {
        console.error('Error loading image data:', err);
      } finally {
        setCurrentImageLoading(false);
      }
    };

    loadImageData();
  }, [currentImageIndex, images]);

  // Show toast
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Handle label submission
  const handleSubmitLabel = async () => {
    if (!classification) {
      setSubmitError(t.pleaseSelectClass);
      return;
    }

    if (!currentImageData) {
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/mil10k/labels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          image_path: `${currentImageData.folder}/${currentImageData.filename}`,
          image_folder: currentImageData.folder,
          image_filename: currentImageData.filename,
          classification,
          confidence_score: parseInt(confidenceScore)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save label');
      }

      showToast(t.labeledSuccessfully);
      
      // Reload stats
      try {
        const statsResponse = await fetch(`${API_BASE_URL}/mil10k/labels-stats`);
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }
      } catch (err) {
        console.error('Error reloading stats:', err);
      }

      // Move to next image
      if (currentImageIndex < images.length - 1) {
        setCurrentImageIndex(currentImageIndex + 1);
      } else {
        showToast('All images labeled!');
      }
    } catch (err) {
      setSubmitError(err.message);
      console.error('Error submitting label:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle navigation
  const handlePrevious = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentImageIndex < images.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-brand-600 mx-auto mb-4" />
          <p className="text-gray-700 font-medium">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
        <div className="text-center bg-red-50 p-6 rounded-lg max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-red-800 font-medium">{t.error}</p>
          <p className="text-red-600 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-700 font-medium">{t.noImages}</p>
        </div>
      </div>
    );
  }

  const currentImage = images[currentImageIndex];
  const hasLabel = currentLabel !== null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t.title}</h1>
          <p className="text-gray-600">{t.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Image Viewer */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              {/* Progress */}
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {t.currentImage} {currentImageIndex + 1} {t.of} {images.length}
                </span>
                <div className="w-48 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-brand-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${((currentImageIndex + 1) / images.length) * 100}%`
                    }}
                  />
                </div>
              </div>

              {/* Image Container (constrained height so page fits) */}
              <div className="bg-gray-100 rounded-lg overflow-hidden mb-6 flex items-center justify-center max-h-[60vh]">
                {currentImageLoading ? (
                  <div className="flex flex-col items-center justify-center">
                    <Loader2 className="w-12 h-12 animate-spin text-brand-600 mb-2" />
                    <p className="text-gray-500 text-sm">Loading image...</p>
                  </div>
                ) : currentImageData ? (
                  <img
                    src={`data:${currentImageData.mime_type};base64,${currentImageData.data}`}
                    alt="Current dermatology image"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <p className="text-gray-500">Failed to load image</p>
                )}
              </div>

              {/* Image Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Folder:</span> {currentImage.folder}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">File:</span> {currentImage.filename}
                </p>
                {hasLabel && (
                  <p className="text-sm text-green-700 mt-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Previously labeled by: {currentLabel.doctor_name}
                  </p>
                )}
              </div>

              {/* Labeling Form */}
              <div className="space-y-4">
                {/* Classification */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t.classification}
                  </label>
                  <select
                    value={classification}
                    onChange={(e) => setClassification(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  >
                    <option value="">{t.selectClass}</option>
                    {CLASS_NAMES.map((className) => (
                      <option key={className} value={className}>
                        {className} - {CLASS_DESCRIPTIONS[className] || ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Confidence Score */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t.confidence}: {confidenceScore}/5
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={confidenceScore}
                      onChange={(e) => setConfidenceScore(e.target.value)}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{t.veryLow}</span>
                    <span>{t.medium}</span>
                    <span>{t.veryHigh}</span>
                  </div>
                </div>

                {/* Error Message */}
                {submitError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <span className="text-sm text-red-700">{submitError}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleSubmitLabel}
                  disabled={submitting || !classification}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-all ${
                    submitting || !classification
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-brand-600 hover:bg-brand-700 active:scale-95'
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t.submitting}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      {t.submit}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-4">
              <button
                onClick={handlePrevious}
                disabled={currentImageIndex === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
                {t.previous}
              </button>
              <button
                onClick={handleNext}
                disabled={currentImageIndex === images.length - 1}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {t.next}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Statistics Sidebar */}
          <div className="lg:col-span-1">
            {/* Progress Stats */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-6 h-6 text-brand-600" />
                <h2 className="text-lg font-bold text-gray-900">{t.progressTitle}</h2>
              </div>

              {loadingStats ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : stats ? (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{stats.total_images}</p>
                    <p className="text-sm text-gray-600">{t.totalImages}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-xl font-bold text-green-600">{stats.labeled_count}</p>
                      <p className="text-xs text-gray-600">{t.labeled}</p>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-lg">
                      <p className="text-xl font-bold text-orange-600">{stats.unlabeled_count}</p>
                      <p className="text-xs text-gray-600">{t.unlabeled}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-100 rounded-lg">
                    <p className="text-sm font-semibold text-gray-700 mb-1">{t.completion}</p>
                    <div className="w-full bg-gray-300 rounded-full h-3">
                      <div
                        className="bg-brand-600 h-3 rounded-full transition-all"
                        style={{
                          width: `${stats.completion_percentage}%`
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{stats.completion_percentage}%</p>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Distribution */}
            {stats && stats.distribution && Object.keys(stats.distribution).length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">{t.distribution}</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {Object.entries(stats.distribution)
                    .sort((a, b) => b[1] - a[1])
                    .map(([className, count]) => (
                      <div key={className} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 font-medium">{className}</span>
                        <span className="text-gray-600">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in-up">
          <CheckCircle className="w-5 h-5" />
          {toast}
        </div>
      )}
    </div>
  );
}
