import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, History, Loader2, MessageSquareText, RefreshCw, Trash2 } from 'lucide-react';
import {
  createSecondOpinionComment,
  deleteSecondOpinionPost,
  fetchSecondOpinionPosts,
} from '../services/secondOpinionService';
import { authMe } from '../services/authService';

const DOCTOR_NAME_STORAGE_KEY = 'suderm_second_opinion_doctor_name';

const normalizeName = (value) =>
  (value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

export default function SecondOpinionFeed({ language = 'en', doctorProfile, onViewHistory }) {
  const texts = {
    en: {
      title: 'Second Opinion Feed',
      subtitle: 'Review and comment on shared cases.',
      search: 'Search by doctor, caption or patient id',
      patientHistory: 'Patient History',
      comments: 'Comments',
      addComment: 'Add Comment',
      noComment: 'No comments yet',
      loading: 'Loading feed...',
      refreshing: 'Refreshing feed...',
      error: 'Could not load second opinion feed.',
      deletePost: 'Delete Post',
      deleting: 'Deleting...',
      refresh: 'Refresh feed',
      metadata: 'Metadata',
      noResults: 'No matching posts.',
    },
    tr: {
      title: 'İkinci Görüş Akışı',
      subtitle: 'Paylaşılan vakaları inceleyip yorum yapın.',
      search: 'Doktor, açıklama veya hasta id ile ara',
      patientHistory: 'Hasta Geçmişi',
      comments: 'Yorumlar',
      addComment: 'Yorum Ekle',
      noComment: 'Henüz yorum yok',
      loading: 'Akış yükleniyor...',
      refreshing: 'Akış yenileniyor...',
      error: 'İkinci görüş akışı yüklenemedi.',
      deletePost: 'Postu Sil',
      deleting: 'Siliniyor...',
      refresh: 'Akışı yenile',
      metadata: 'Metaveri',
      noResults: 'Eşleşen post bulunamadı.',
    }
  };
  const t = texts[language] || texts.en;
  const loadErrorText = t.error;

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [postingCommentId, setPostingCommentId] = useState(null);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [currentDoctorName, setCurrentDoctorName] = useState('');
  const [commentDrafts, setCommentDrafts] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let cancelled = false;

    const resolveViewerName = async () => {
      try {
        const me = await authMe();
        if (!cancelled) {
          setCurrentDoctorName((me?.display_name || '').trim());
        }
        return;
      } catch {
        // Fallback for guest/no-token mode.
      }

      const savedName = window.localStorage.getItem(DOCTOR_NAME_STORAGE_KEY);
      if (!cancelled) {
        setCurrentDoctorName((savedName || doctorProfile?.name || '').trim());
      }
    };

    void resolveViewerName();
    return () => {
      cancelled = true;
    };
  }, [doctorProfile?.name]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSecondOpinionPosts();
      setPosts(data);
    } catch (err) {
      setError(err.message || loadErrorText);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [loadErrorText]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const filteredPosts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return posts.filter((post) => {
      if (!query) return true;

      const raw = post.raw || {};
      const bucket = [
        post.doctorName,
        post.affiliation,
        post.caption,
        raw.patient_id,
        raw.lesion_location,
        raw.diagnosis,
        raw.current_hypothesis,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return bucket.includes(query);
    });
  }, [posts, searchTerm]);

  const getMetadataPills = (post) => {
    const raw = post.raw || {};
    return [
      raw.patient_id && { label: 'Patient', value: raw.patient_id },
      raw.lesion_location && { label: 'Location', value: raw.lesion_location },
      raw.diagnosis && { label: 'Diagnosis', value: raw.diagnosis },
      raw.current_hypothesis && { label: 'Hypothesis', value: raw.current_hypothesis },
      raw.age_group && { label: 'Age', value: raw.age_group },
      raw.sex && { label: 'Sex', value: raw.sex },
    ].filter(Boolean);
  };

  const addComment = async (postId, commentText) => {
    const trimmedComment = commentText.trim();
    if (!trimmedComment) return;

    setPostingCommentId(postId);
    try {
      const createdComment = await createSecondOpinionComment(postId, {
        is_anonymous: false,
        author_name: doctorProfile?.name || 'Doctor',
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
                    author: createdComment.author_name,
                  },
                ],
              }
            : post
        )
      );
        setCommentDrafts((prev) => ({
          ...prev,
          [postId]: '',
        }));
    } catch (err) {
        setError(err.message || loadErrorText);
    } finally {
      setPostingCommentId(null);
    }
  };

  const handleViewHistory = (post) => {
    if (!onViewHistory) return;

    onViewHistory({
      location: post.raw?.lesion_location || '',
      diagnosis: post.raw?.diagnosis || '',
      ageGroup: post.raw?.age_group || '',
      sex: post.raw?.sex || '',
      skinTone: post.raw?.skin_tone || '',
      patientId: post.raw?.patient_id || '',
      currentHypothesis: post.raw?.current_hypothesis || '',
    });
  };

  const canDeletePost = (post) => {
    const postDoctor = normalizeName(post.doctorName);
    const viewerDoctor = normalizeName(currentDoctorName);
    if (!viewerDoctor) return false;
    return postDoctor === viewerDoctor;
  };

  const handleDeletePost = async (post) => {
    if (!post?.id) return;

    setError('');
    setDeletingPostId(post.id);

    try {
      await deleteSecondOpinionPost(post.id);
      setPosts((prev) => prev.filter((item) => item.id !== post.id));
    } catch (err) {
      setError(err.message || loadErrorText);
    } finally {
      setDeletingPostId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t.title}</h2>
          <p className="text-sm text-gray-500">{t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={loadPosts}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? t.refreshing : t.refresh}
        </button>
      </div>

      <div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t.search}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </div>

      {error && (
        <div className="mx-6 mt-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:mx-8">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && posts.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          {t.loading}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          {t.noResults}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => {
            const metadataPills = getMetadataPills(post);
            const draftValue = commentDrafts[post.id] ?? '';

            return (
              <article key={post.id} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold uppercase text-white">
                        {post.doctorName || 'Doctor'}
                      </span>
                      {post.affiliation && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                          {post.affiliation}
                        </span>
                      )}
                    </div>
                    <p className="max-w-3xl whitespace-pre-line text-sm leading-6 text-gray-700">{post.caption}</p>
                    <div className="flex flex-wrap gap-2">
                      {metadataPills.length > 0 ? (
                        metadataPills.map((pill) => (
                          <span
                            key={`${post.id}-${pill.label}-${pill.value}`}
                            className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700"
                          >
                            {pill.label}: {pill.value}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-500">
                          {t.metadata}: Not provided
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:items-end">
                    {canDeletePost(post) && (
                      <button
                        type="button"
                        onClick={() => handleDeletePost(post)}
                        disabled={deletingPostId === post.id}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        {deletingPostId === post.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t.deleting}
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4" />
                            {t.deletePost}
                          </>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleViewHistory(post)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-700"
                      aria-label="View patient history"
                    >
                      <History className="h-4 w-4" />
                      {t.patientHistory}
                    </button>
                  </div>
                </div>

                {post.uploads.length > 0 && (
                  <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                    {post.uploads.map((item, idx) => (
                      <div key={idx} className="relative aspect-square overflow-hidden rounded-md border border-gray-200 bg-gray-100">
                        <img
                          src={item.preview}
                          alt={`upload ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-gray-100 pt-3">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <MessageSquareText className="h-4 w-4" />
                    {t.comments} ({post.comments.length})
                  </div>

                  {post.comments.length > 0 ? (
                    <div className="space-y-2">
                      {post.comments.map((comment) => (
                        <div key={comment.id} className="rounded-md bg-gray-50 px-3 py-2 text-sm">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                            {comment.author}
                          </div>
                          <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{comment.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-500">
                      {t.noComment}
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={draftValue}
                      placeholder={t.addComment}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      disabled={postingCommentId === post.id}
                      onChange={(e) =>
                        setCommentDrafts((prev) => ({
                          ...prev,
                          [post.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addComment(post.id, draftValue);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => addComment(post.id, draftValue)}
                      disabled={postingCommentId === post.id || !draftValue.trim()}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {postingCommentId === post.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
                      {t.addComment}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}