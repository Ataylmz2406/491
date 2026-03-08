import React, { useState } from 'react';

export default function SecondOpinion({ onViewHistory, questionMetadata, doctorProfile }) {
  // patient-specific states
  const [patientId, setPatientId] = useState('');
  const [currentHypothesis, setCurrentHypothesis] = useState('');
  const [uploads, setUploads] = useState([]); // {file, preview, comment, posted}

  const handleFileAdd = (e) => {
    const files = Array.from(e.target.files);
    const newItems = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      comment: '',
      posted: false
    }));
    setUploads((prev) => [...prev, ...newItems]);
  };

  const updateComment = (idx, text) => {
    setUploads((prev) => {
      const copy = [...prev];
      copy[idx].comment = text;
      return copy;
    });
  };

  const postComment = (idx) => {
    setUploads((prev) => {
      const copy = [...prev];
      if (copy[idx].comment) {
        copy[idx].posted = true;
      }
      return copy;
    });
  };

  const removeUpload = (idx) => {
    setUploads((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="bg-white border border-gray-200 shadow-xl rounded-2xl p-6 flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Doctor Name</label>
          <input
            type="text"
            value={doctorProfile?.name || ''}
            readOnly
            className="w-full px-3 py-2 border rounded-md bg-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Affiliation / Notes</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID</label>
          <input
            type="text"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="Enter patient identifier"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Current Hypothesis</label>
          <select
            value={currentHypothesis}
            onChange={(e) => setCurrentHypothesis(e.target.value)}
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
        <label className="block text-sm font-medium text-gray-700 mb-2">Upload Images</label>
        <label className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-full cursor-pointer">
          Choose an image
          <input type="file" multiple accept="image/*" onChange={handleFileAdd} className="hidden" />
        </label>
      </div>

      {uploads.length > 0 && (
        <div className="space-y-6">
          {uploads.map((item, idx) => (
            <div key={idx} className="border p-4 rounded-lg relative">
              <button
                className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                onClick={() => removeUpload(idx)}
              >
                ✕
              </button>
              <img
                src={item.preview}
                alt="upload preview"
                className="w-full max-w-xs object-contain mb-2"
              />
              <textarea
                value={item.comment}
                onChange={(e) => updateComment(idx, e.target.value)}
                placeholder="Comment on this image"
                className="w-full px-3 py-2 border rounded-md"
                disabled={item.posted}
              />
              <div className="mt-2 flex gap-2">
                {patientId && (
                  <button
                    onClick={() => onViewHistory({
                      ...questionMetadata,
                      patientId,
                      currentHypothesis
                    })}
                    className="text-sm text-white bg-teal-600 hover:bg-teal-700 px-3 py-1 rounded"
                  >
                    History / Metadata
                  </button>
                )}
                <button
                  onClick={() => postComment(idx)}
                  disabled={!item.comment || item.posted}
                  className={`text-sm text-white px-3 py-1 rounded ${item.posted ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                >
                  {item.posted ? 'Posted' : 'Post'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
