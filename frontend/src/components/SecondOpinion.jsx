import React, { useState } from 'react';

export default function SecondOpinion({ language = 'en', onViewHistory, questionMetadata, doctorProfile }) {
  const translations = {
    en: {
      doctorName: 'Doctor Name',
      affiliation: 'Affiliation / Notes',
      patientId: 'Patient ID',
      aiPrediction: 'AI Prediction',
      uploadImages: 'Upload Images',
      chooseImages: 'Choose images',
      notSpecified: 'Not specified',
      notes: 'Notes',
      addNotes: 'Add notes for the images...',
      postSecondOpinion: 'Post Second Opinion',
      comments: 'Comments',
      addComment: 'Add Comment',
      noNotes: 'No notes',
      patientHistory: 'History / Metadata',
      remove: '✕'
    },
    tr: {
      doctorName: 'Doktor Adı',
      affiliation: 'Kurum / Notlar',
      patientId: 'Hasta ID',
      aiPrediction: 'AI Tahmini',
      uploadImages: 'Görüntü Yükleyin',
      chooseImages: 'Görüntüleri seç',
      notSpecified: 'Belirtilmedi',
      notes: 'Notlar',
      addNotes: 'Görüntüler için notlar ekleyin...',
      postSecondOpinion: 'İkinci Görüş Gönder',
      comments: 'Yorumlar',
      addComment: 'Yorum Ekle',
      noNotes: 'Not yok',
      patientHistory: 'Geçmiş / Metaveri',
      remove: '✕'
    }
  };
  const t = translations[language] || translations.en;

  // patient-specific states
  const [patientId, setPatientId] = useState('');
  const [aiPrediction, setAiPrediction] = useState('');
  const [posts, setPosts] = useState([]); // array of { id, uploads: [], notes: '', comments: [], posted: false }

  const handleFileAdd = (e) => {
    const files = Array.from(e.target.files);
    const newItems = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file)
    }));

    setPosts((prev) => {
      const lastPost = prev[prev.length - 1];
      if (lastPost && !lastPost.posted) {
        // Add to existing unposted post
        const updatedPosts = [...prev];
        updatedPosts[updatedPosts.length - 1].uploads = [...lastPost.uploads, ...newItems];
        return updatedPosts;
      } else {
        // Create new post
        const newPost = {
          id: Date.now(),
          uploads: newItems,
          notes: '',
          comments: [],
          posted: false
        };
        return [...prev, newPost];
      }
    });
  };

  const updateNotes = (postId, text) => {
    setPosts((prev) => prev.map(post => post.id === postId ? { ...post, notes: text } : post));
  };

  const addComment = (postId, comment) => {
    if (comment.trim()) {
      setPosts((prev) => prev.map(post => post.id === postId ? { ...post, comments: [...post.comments, comment.trim()] } : post));
    }
  };

  const removeComment = (postId, idx) => {
    setPosts((prev) => prev.map(post => post.id === postId ? { ...post, comments: post.comments.filter((_, i) => i !== idx) } : post));
  };

  const postOpinion = (postId) => {
    setPosts((prev) => prev.map((post) => {
      if (post.id !== postId) return post;

      const metadataParts = [];
      if (questionMetadata?.location) metadataParts.push(`Location: ${questionMetadata.location}`);
      if (questionMetadata?.diagnosis) metadataParts.push(`Diagnosis: ${questionMetadata.diagnosis}`);
      if (questionMetadata?.ageGroup) metadataParts.push(`Age Group: ${questionMetadata.ageGroup}`);
      if (questionMetadata?.sex) metadataParts.push(`Sex: ${questionMetadata.sex}`);
      if (questionMetadata?.skinTone) metadataParts.push(`Skin Tone: ${questionMetadata.skinTone}`);
      if (patientId) metadataParts.push(`Patient ID: ${patientId}`);
      if (aiPrediction) metadataParts.push(`AI Prediction: ${aiPrediction}`);

      const metadataText = metadataParts.join(' | ');
      const newNotes = [post.notes, metadataText].filter(Boolean).join('\n\n');

      return { ...post, posted: true, notes: newNotes };
    }));
  };

  const viewHistory = () => {
    onViewHistory({
      ...questionMetadata,
      patientId,
      aiPrediction
    });
  };

  const removeUpload = (postId, idx) => {
    setPosts((prev) => prev.map(post => post.id === postId ? { ...post, uploads: post.uploads.filter((_, i) => i !== idx) } : post));
  };

  return (
    <div className="bg-white border border-gray-200 shadow-xl rounded-2xl p-6 flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.doctorName}</label>
          <input
            type="text"
            value={doctorProfile?.name || ''}
            readOnly
            className="w-full px-3 py-2 border rounded-md bg-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.affiliation}</label>
          <input
            type="text"
            value={doctorProfile?.info || ''}
            readOnly
            className="w-full px-3 py-2 border rounded-md bg-gray-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.patientId}</label>
          <input
            type="text"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            placeholder={t.patientId}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.aiPrediction}</label>
          <select
            value={aiPrediction}
            onChange={(e) => setAiPrediction(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="">Not specified</option>
            <option value="AKIEC">Actinic keratosis / intraepidermal carcinoma</option>
            <option value="BCC">Basal cell carcinoma</option>
            <option value="BEN_OTH">Other benign proliferations, including collision tumors</option>
            <option value="BKL">Benign keratinocytic lesion</option>
            <option value="DF">Dermatofibroma</option>
            <option value="INF">Inflammatory and infectious conditions</option>
            <option value="MAL_OTH">Other malignant proliferations, including collision tumors</option>
            <option value="MEL">Melanoma</option>
            <option value="NV">Melanocytic nevus</option>
            <option value="SCCKA">Squamous cell carcinoma / keratoacanthoma</option>
            <option value="VASC">Vascular lesions and hemorrhage</option>
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">{t.uploadImages}</label>
        <label className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-full cursor-pointer">
          {t.chooseImages}
          <input type="file" multiple accept="image/*" onChange={handleFileAdd} className="hidden" />
        </label>
      </div>

      {posts.map((post) => (
        <div key={post.id} className="border p-4 rounded-lg">
          {patientId && (
            <div className="flex justify-end mb-4">
              <button
                onClick={viewHistory}
                className="text-sm text-white bg-teal-600 hover:bg-teal-700 px-3 py-1 rounded"
              >
                {t.patientHistory}
              </button>
            </div>
          )}
          {post.uploads.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 auto-rows-fr">
              {post.uploads.map((item, idx) => (
                <div key={idx} className="relative aspect-square">
                  {!post.posted && (
                    <button
                      className="absolute top-1 right-1 text-red-500 hover:text-red-700 bg-white rounded-full p-1 z-10"
                      onClick={() => removeUpload(post.id, idx)}
                    >
                      ✕
                    </button>
                  )}
                  <img
                    src={item.preview}
                    alt={`upload ${idx + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
              ))}
            </div>
          )}

          {!post.posted && (
            <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.notes}</label>
                  <textarea
                    value={post.notes}
                    onChange={(e) => updateNotes(post.id, e.target.value)}
                    placeholder={t.addNotes}
                    className="w-full px-3 py-2 border rounded-md"
                    rows={2}
                  />
                </div>
              )}

              {post.posted && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700">{t.notes}:</p>
                  <p className="text-gray-800">{post.notes || t.noNotes}</p>
                </div>
              )}

          {!post.posted && (
            <div className="flex justify-end mb-4">
              <button
                onClick={() => postOpinion(post.id)}
                disabled={!patientId.trim() || post.uploads.length === 0}
                className="px-6 py-2 bg-indigo-600 text-white rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {t.postSecondOpinion}
              </button>
            </div>
          )}

          {post.posted && (
            <div className="border-t pt-4">
              <h3 className="text-lg font-medium mb-2">{t.comments}</h3>
              <div className="flex gap-2 mb-4">
                <textarea
                  placeholder={t.addComment}
                  className="flex-1 px-3 py-2 border rounded-md"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      addComment(post.id, e.target.value);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const textarea = e.target.previousSibling;
                    addComment(post.id, textarea.value);
                    textarea.value = '';
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md"
                >
                  {t.addComment}
                </button>
              </div>
              {post.comments.length > 0 && (
                <div className="space-y-2">
                  {post.comments.map((comment, idx) => (
                    <div key={idx} className="flex justify-between items-start bg-gray-50 p-2 rounded">
                      <p className="flex-1">{comment}</p>
                      <button
                        onClick={() => removeComment(post.id, idx)}
                        className="text-red-500 hover:text-red-700 ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
