import React, { useState } from 'react';

const DUMMY_POSTS = [
  {
    id: 1,
    doctorName: 'Dr. John Smith',
    affiliation: 'General Hospital',
    caption: 'Suspected basal cell carcinoma on the nose. Looking for confirmation.\n\nLocation: Face | Diagnosis: BCC | Age Group: 50-59 | Sex: Male | Skin Tone: Fair | Patient ID: P-2024-001 | AI Prediction: BCC',
    uploads: [
      { preview: '/src/assets/pigmented-lesion-01.jpg' }, // placeholder
      { preview: '/src/assets/Skin-Lesions-2.jpg' }
    ],
    comments: [
      { id: 1, text: 'Agree with BCC diagnosis.', author: 'Dr. Emily Davis' },
      { id: 2, text: 'Consider biopsy to confirm.', author: 'Dr. Michael Brown' }
    ],
    posted: true
  },
  {
    id: 2,
    doctorName: 'Dr. Sarah Johnson',
    affiliation: 'Dermatology Clinic',
    caption: 'Melanoma concern on back. Urgent second opinion needed.\n\nLocation: Back | Diagnosis: MEL | Age Group: 40-49 | Sex: Female | Skin Tone: Medium | Patient ID: P-2024-002 | AI Prediction: MEL',
    uploads: [
      { preview: '/src/assets/What_Causes_Vascular_Skin_Lesions1-1080x675.png' }
    ],
    comments: [
      { id: 1, text: 'Looks malignant, recommend excision.', author: 'Dr. Robert Wilson' }
    ],
    posted: true
  },
  {
    id: 3,
    doctorName: 'Dr. David Lee',
    affiliation: 'Skin Cancer Center',
    caption: 'Benign nevus, but monitoring advised.\n\nLocation: Arm | Diagnosis: NV | Age Group: 30-39 | Sex: Male | Skin Tone: Olive | Patient ID: P-2024-003 | AI Prediction: NV',
    uploads: [
      { preview: '/src/assets/pigmented-lesion-01.jpg' },
      { preview: '/src/assets/Skin-Lesions-2.jpg' },
      { preview: '/src/assets/What_Causes_Vascular_Skin_Lesions1-1080x675.png' }
    ],
    comments: [],
    posted: true
  }
];

export default function SecondOpinionFeed({ language = 'en', doctorProfile, onViewHistory }) {
  const texts = {
    en: {
      title: 'Second Opinion Feed',
      subtitle: "Comment on other doctors' second opinion requests.",
      patientHistory: 'Patient History',
      comments: 'Comments',
      addComment: 'Add Comment',
      noComment: 'No comments yet',
      remove: '✕'
    },
    tr: {
      title: 'İkinci Görüş Akışı',
      subtitle: 'Diğer doktorların ikinci görüş taleplerine yorum yapın.',
      patientHistory: 'Hasta Geçmişi',
      comments: 'Yorumlar',
      addComment: 'Yorum Ekle',
      noComment: 'Henüz yorum yok',
      remove: '✕'
    }
  };
  const t = texts[language] || texts.en;

  const [posts, setPosts] = useState(DUMMY_POSTS);

  const addComment = (postId, commentText) => {
    if (!commentText.trim()) return;
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: [
                ...post.comments,
                {
                  id: Date.now(),
                  text: commentText.trim(),
                  author: doctorProfile?.name || 'Anonymous Doctor'
                }
              ]
            }
          : post
      )
    );
  };

  const removeComment = (postId, commentId) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? { ...post, comments: post.comments.filter((c) => c.id !== commentId) }
          : post
      )
    );
  };

  return (
    <div className="bg-white border border-gray-200 shadow-xl rounded-2xl p-6 flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-gray-800">{t.title}</h2>
      <p className="text-sm text-gray-600">{t.subtitle}</p>

      {posts.map((post) => (
        <div key={post.id} className="border p-4 rounded-lg bg-gray-50">
          <div className="mb-4 flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-gray-800">{post.doctorName}</span>
                <span className="text-sm text-gray-500">({post.affiliation})</span>
              </div>
              <p className="text-gray-800 whitespace-pre-line">{post.caption}</p>
            </div>
            <button
              onClick={() => onViewHistory()}
              className="text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg px-3 py-1 transition ml-4"
              aria-label="View patient history"
            >
              {t.patientHistory}
            </button>
          </div>

          {post.uploads.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 auto-rows-fr">
              {post.uploads.map((item, idx) => (
                <div key={idx} className="relative aspect-square">
                  <img
                    src={item.preview}
                    alt={`upload ${idx + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-4">
            <h3 className="text-lg font-medium mb-2">{t.comments} ({post.comments.length})</h3>
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
                {post.comments.map((comment) => (
                  <div key={comment.id} className="flex justify-between items-start bg-white p-2 rounded">
                    <div>
                      <span className="font-medium text-gray-700">{comment.author}:</span> {comment.text}
                    </div>
                    <button
                      onClick={() => removeComment(post.id, comment.id)}
                      className="text-red-500 hover:text-red-700 ml-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}