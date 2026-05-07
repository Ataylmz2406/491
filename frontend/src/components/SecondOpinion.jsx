import React, { useEffect, useState } from 'react';
import { AlertCircle, History, Loader2, MessageSquareText, Send, Trash2, Upload } from 'lucide-react';
import {
  SECOND_OPINION_DISEASE_OPTIONS,
  buildSecondOpinionMetadata,
  createSecondOpinionComment,
  createSecondOpinionPost,
  normalizeSecondOpinionPost,
} from '../services/secondOpinionService';
import { friendlyApiMessage } from '../services/apiErrorService';

const DOCTOR_NAME_STORAGE_KEY = 'suderm_second_opinion_doctor_name';
const DOCTOR_AFFILIATION_STORAGE_KEY = 'suderm_second_opinion_doctor_affiliation';
const CAPTION_MAX = 500;
const SECOND_OPINION_MAX_IMAGES = 12;
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.82;

export default function SecondOpinion({ language = 'en', onViewHistory, questionMetadata, doctorProfile }) {
  const translations = {
    en: {
      title: 'Ask for Second Opinion',
      doctorName: 'Doctor Name',
      affiliation: 'Affiliation',
      patientId: 'Patient ID',
      optional: 'Optional',
      currentHypothesis: 'AI prediction',
      uploadImages: 'Upload images',
      chooseImages: 'Choose images',
      resetForm: 'Clear draft',
      caption: 'Notes',
      addCaption: 'Add notes for the images...',
      captionCount: 'characters',
      postSecondOpinion: 'Post Second Opinion',
      posting: 'Posting...',
      comments: 'Comments',
      addComment: 'Add Comment',
      commentAnonymously: 'Comment anonymously',
      noCaption: 'No notes',
      noComments: 'No comments yet',
      patientHistory: 'History / Metadata',
      errorPrefix: 'Could not save second opinion:',
      removeImage: 'Remove image',
      addImageFirst: 'Please add at least one image.',
      hypothesisRequired: 'AI prediction is required before posting.',
      missingHypothesis: 'AI prediction',
      missingImages: 'at least one image',
      completeRequired: 'Complete required fields:',
      maxImages: `You can upload up to ${SECOND_OPINION_MAX_IMAGES} images.`,
      imageProcessError: 'One or more images could not be processed.',
    },
    tr: {
      title: 'İkinci Görüş İste',
      doctorName: 'Doktor Adı',
      affiliation: 'Kurum',
      patientId: 'Hasta ID',
      optional: 'Opsiyonel',
      currentHypothesis: 'Yapay Zeka Tahmini',
      uploadImages: 'Görüntü yükle',
      chooseImages: 'Görüntüleri seç',
      resetForm: 'Taslağı temizle',
      caption: 'Notlar',
      addCaption: 'Görüntüler için not ekleyin...',
      captionCount: 'karakter',
      postSecondOpinion: 'İkinci Görüş Gönder',
      posting: 'Gönderiliyor...',
      comments: 'Yorumlar',
      addComment: 'Yorum Ekle',
      commentAnonymously: 'Anonim yorum yap',
      noCaption: 'Not yok',
      noComments: 'Henüz yorum yok',
      patientHistory: 'Geçmiş / Metaveri',
      errorPrefix: 'İkinci görüş kaydedilemedi:',
      removeImage: 'Görüntüyü kaldır',
      addImageFirst: 'Lütfen en az bir görüntü ekleyin.',
      hypothesisRequired: 'Göndermeden önce yapay zeka tahmini gerekli.',
      missingHypothesis: 'Yapay zeka tahmini',
      missingImages: 'en az bir görüntü',
      completeRequired: 'Zorunlu alanları tamamlayın:',
      maxImages: `En fazla ${SECOND_OPINION_MAX_IMAGES} görüntü yükleyebilirsiniz.`,
      imageProcessError: 'Bir veya daha fazla görüntü işlenemedi.',
    },
  };
  const t = translations[language] || translations.en;

  const [patientId, setPatientId] = useState('');
  const [currentHypothesis, setCurrentHypothesis] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [doctorAffiliation, setDoctorAffiliation] = useState('');
  const [draft, setDraft] = useState({ uploads: [], caption: '' });
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState('');
  const [posting, setPosting] = useState(false);
  const [postingCommentId, setPostingCommentId] = useState(null);  // tracks which post comment is being submitted
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentAnonymous, setCommentAnonymous] = useState({});   // per-post anonymous comment checkbox
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    const profileName = (doctorProfile?.name || '').trim();
    const profileAffiliation = (doctorProfile?.info || '').trim();
    const savedDoctorName = (window.localStorage.getItem(DOCTOR_NAME_STORAGE_KEY) || '').trim();
    const savedDoctorAffiliation = (window.localStorage.getItem(DOCTOR_AFFILIATION_STORAGE_KEY) || '').trim();

    setDoctorName(profileName || savedDoctorName);
    setDoctorAffiliation(profileAffiliation || savedDoctorAffiliation);
  }, [doctorProfile?.name, doctorProfile?.info]);

  useEffect(() => {
    if (doctorName.trim()) {
      window.localStorage.setItem(DOCTOR_NAME_STORAGE_KEY, doctorName.trim());
    }
  }, [doctorName]);

  useEffect(() => {
    if (doctorAffiliation.trim()) {
      window.localStorage.setItem(DOCTOR_AFFILIATION_STORAGE_KEY, doctorAffiliation.trim());
    }
  }, [doctorAffiliation]);

  useEffect(() => {
    return () => {
      draft.uploads.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, [draft.uploads]);

  const compressImageFile = (file) =>
    new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Only image files are supported'));
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        const sourceWidth = img.naturalWidth || img.width;
        const sourceHeight = img.naturalHeight || img.height;
        const maxSide = Math.max(sourceWidth, sourceHeight);
        const scale = maxSide > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / maxSide : 1;

        const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
        const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Image processing context could not be created'));
          return;
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Image compression failed'));
              return;
            }

            const compressedFile = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, '.jpg'),
              { type: 'image/jpeg' }
            );
            resolve(compressedFile);
          },
          'image/jpeg',
          IMAGE_QUALITY
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Image decoding failed'));
      };

      img.src = objectUrl;
    });

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });

  const handleFileAdd = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const availableSlots = Math.max(0, SECOND_OPINION_MAX_IMAGES - draft.uploads.length);
    if (availableSlots === 0) {
      setError(t.maxImages);
      e.target.value = '';
      return;
    }

    const selectedFiles = files.slice(0, availableSlots);

    setError('');
    try {
      const compressedFiles = await Promise.all(selectedFiles.map((file) => compressImageFile(file)));
      const newItems = compressedFiles.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));

      setDraft((prev) => ({
        ...prev,
        uploads: [...prev.uploads, ...newItems],
      }));

      if (files.length > selectedFiles.length) {
        setError(t.maxImages);
      }
    } catch (err) {
      setError(err.message || t.imageProcessError);
    }

    e.target.value = '';
  };

  const removeUpload = (idx) => {
    setDraft((prev) => {
      const removing = prev.uploads[idx];
      if (removing) {
        URL.revokeObjectURL(removing.preview);
      }
      return {
        ...prev,
        uploads: prev.uploads.filter((_, i) => i !== idx),
      };
    });
  };

  const resetDraft = () => {
    draft.uploads.forEach((item) => URL.revokeObjectURL(item.preview));
    setPatientId('');
    setCurrentHypothesis('');
    setDraft({ uploads: [], caption: '' });
    setError('');
    setIsAnonymous(false); // reset anonymous toggle after submit
  };

  const postOpinion = async () => {
    if (draft.uploads.length === 0) {
      setError(t.addImageFirst);
      return;
    }

    if (!currentHypothesis.trim()) {
      setError(t.hypothesisRequired);
      return;
    }

    setError('');
    setPosting(true);

    try {
      const imageUrls = await Promise.all(draft.uploads.map((item) => fileToDataUrl(item.file)));
      const metadata = buildSecondOpinionMetadata(questionMetadata, patientId, currentHypothesis);

      const createdPost = await createSecondOpinionPost({
        is_anonymous: isAnonymous,
        doctor_name: doctorName.trim() || 'Doctor',
        doctor_affiliation: doctorAffiliation.trim() || null,
        question_text: draft.caption.trim() || 'Second opinion request',
        image_urls: imageUrls,
        ...metadata,
      });

      const normalizedPost = normalizeSecondOpinionPost(createdPost);
      setPosts((prev) => [normalizedPost, ...prev]);
      resetDraft();
    } catch (err) {
      setError(`${t.errorPrefix} ${friendlyApiMessage(err.message, 'Unknown error')}`);
    } finally {
      setPosting(false);
    }
  };

  const addComment = async (postId, comment) => {
    const trimmedComment = comment.trim();
    if (!trimmedComment) return;

    setError('');
    setPostingCommentId(postId); // immediately disable button to prevent duplicates
    const isAnonComment = commentAnonymous[postId] ?? false;

    try {
      const createdComment = await createSecondOpinionComment(postId, {
        is_anonymous: isAnonComment,
        author_name: isAnonComment ? null : (doctorName.trim() || 'Doctor'),
        comment_text: trimmedComment,
      });

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                comments: [
                  ...post.comments,
                  {
                    id: createdComment.id,
                    text: createdComment.comment_text,
                    author: createdComment.author_name || 'Anonymous',
                  },
                ],
              }
            : post
        )
      );

      // Clear the draft and anonymous toggle for this post
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
      setCommentAnonymous((prev) => ({ ...prev, [postId]: false }));
    } catch (err) {
      setError(`${t.errorPrefix} ${friendlyApiMessage(err.message, 'Unknown error')}`);
    } finally {
      setPostingCommentId(null);
    }
  };

  const viewHistory = () => {
    if (!onViewHistory) return;

    onViewHistory({
      ...questionMetadata,
      patientId,
      currentHypothesis,
    });
  };

  const captionCount = draft.caption.length;
  const canPost = currentHypothesis.trim() && draft.uploads.length > 0 && !posting;
  const missingPostRequirements = [
    !currentHypothesis.trim() && t.missingHypothesis,
    draft.uploads.length === 0 && t.missingImages,
  ].filter(Boolean);

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">{t.title}</h2>
        {onViewHistory && (
          <button
            type="button"
            onClick={viewHistory}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <History className="h-4 w-4" />
            {t.patientHistory}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t.doctorName} <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={isAnonymous ? '' : doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
            disabled={isAnonymous}
            className={`w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 ${isAnonymous ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-white text-slate-900'}`}
            placeholder={t.doctorName}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t.affiliation}</label>
          <input
            type="text"
            value={doctorAffiliation}
            onChange={(e) => setDoctorAffiliation(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder={t.affiliation}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t.patientId}
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{t.optional}</span>
          </label>
          <input
            type="text"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder={t.patientId}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t.currentHypothesis} <span className="text-red-500">*</span></label>
          <select
            value={currentHypothesis}
            onChange={(e) => setCurrentHypothesis(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {SECOND_OPINION_DISEASE_OPTIONS.map((option) => (
              <option key={option.value || 'none'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Upload className="h-4 w-4" />
            {t.chooseImages}
            <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={handleFileAdd} className="hidden" />
          </label>
          <span className="text-sm text-slate-500">{draft.uploads.length}/{SECOND_OPINION_MAX_IMAGES} file(s)</span>
        </div>

        {draft.uploads.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {draft.uploads.map((item, idx) => (
              <div key={idx} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200">
                <button
                  type="button"
                  title={t.removeImage}
                  onClick={() => removeUpload(idx)}
                  className="absolute right-1 top-1 z-10 rounded-full bg-white p-1 text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <img src={item.preview} alt={`upload ${idx + 1}`} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t.caption} <span className="text-red-500">*</span></label>
        <textarea
          value={draft.caption}
          onChange={(e) => setDraft((prev) => ({ ...prev, caption: e.target.value.slice(0, CAPTION_MAX) }))}
          placeholder={t.addCaption}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          rows={4}
          maxLength={CAPTION_MAX}
        />
        <p className="mt-1 text-right text-xs text-gray-500">
          {captionCount}/{CAPTION_MAX} {t.captionCount}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={resetDraft}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {t.resetForm}
          </button>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 select-none">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => {
                const checked = e.target.checked;
                setIsAnonymous(checked);
                if (checked) {
                  setDoctorName('');
                } else {
                  const profileName = (doctorProfile?.name || '').trim();
                  const savedName = (window.localStorage.getItem(DOCTOR_NAME_STORAGE_KEY) || '').trim();
                  setDoctorName(profileName || savedName);
                }
              }}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span>Post anonymously</span>
          </label>
        </div>
        <button
          type="button"
          onClick={postOpinion}
          disabled={!canPost}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {posting ? t.posting : t.postSecondOpinion}
        </button>
      </div>

      {missingPostRequirements.length > 0 && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {t.completeRequired} {missingPostRequirements.join(', ')}.
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {posts.length > 0 && (
        <div className="space-y-4 border-t border-slate-200 pt-4">
          {posts.map((post) => {
            const postCommentDraft = commentDrafts[post.id] ?? '';

            return (
              <div key={post.id} className="space-y-3 rounded-lg border border-slate-200 p-4">
                <p className="whitespace-pre-line text-sm text-slate-800">{post.caption || t.noCaption}</p>
                {post.uploads.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {post.uploads.map((item, idx) => (
                      <img
                        key={idx}
                        src={item.preview}
                        alt={`post ${post.id} ${idx + 1}`}
                        className="aspect-square w-full rounded-md object-cover"
                      />
                    ))}
                  </div>
                )}

                <div className="border-t border-slate-100 pt-3">
                  <h4 className="mb-2 text-sm font-semibold text-slate-800">{t.comments}</h4>
                  {post.comments.length > 0 ? (
                    <div className="mb-3 space-y-2">
                      {post.comments.map((comment) => (
                        <div key={comment.id} className="rounded-md bg-slate-50 px-3 py-2 text-sm">
                          <span className="font-medium text-slate-700">{comment.author}: </span>
                          <span className="text-slate-700">{comment.text}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mb-3 text-sm text-slate-500">{t.noComments}</p>
                  )}

                  <div className="flex gap-2 flex-wrap items-center">
                    <input
                      type="text"
                      value={postCommentDraft}
                      onChange={(e) =>
                        setCommentDrafts((prev) => ({
                          ...prev,
                          [post.id]: e.target.value,
                        }))
                      }
                      placeholder={t.addComment}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      disabled={postingCommentId === post.id}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addComment(post.id, postCommentDraft);
                        }
                      }}
                    />
                    <label className="flex cursor-pointer select-none items-center gap-1.5 whitespace-nowrap text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={commentAnonymous[post.id] ?? false}
                        onChange={(e) =>
                          setCommentAnonymous((prev) => ({ ...prev, [post.id]: e.target.checked }))
                        }
                        className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span>{t.commentAnonymously}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => addComment(post.id, postCommentDraft)}
                      disabled={postingCommentId === post.id || !postCommentDraft.trim()}
                      className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {postingCommentId === post.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <MessageSquareText className="h-4 w-4" />}
                      {t.addComment}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
