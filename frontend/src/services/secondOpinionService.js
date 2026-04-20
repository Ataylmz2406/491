const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
import { getAccessToken } from './authService';

async function request(path, options = {}) {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {
      // fall through with default message
    }
    throw new Error(message);
  }

  return response.json();
}

export const SECOND_OPINION_DISEASE_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'AKIEC', label: 'Actinic keratosis / intraepidermal carcinoma' },
  { value: 'BCC', label: 'Basal cell carcinoma' },
  { value: 'BEN_OTH', label: 'Other benign proliferations, including collision tumors' },
  { value: 'BKL', label: 'Benign keratinocytic lesion' },
  { value: 'DF', label: 'Dermatofibroma' },
  { value: 'INF', label: 'Inflammatory and infectious conditions' },
  { value: 'MAL_OTH', label: 'Other malignant proliferations, including collision tumors' },
  { value: 'MEL', label: 'Melanoma' },
  { value: 'NV', label: 'Melanocytic nevus' },
  { value: 'SCCKA', label: 'Squamous cell carcinoma / keratoacanthoma' },
  { value: 'VASC', label: 'Vascular lesions and hemorrhage' },
];

export function buildSecondOpinionMetadata(questionMetadata = {}, patientId = '', currentHypothesis = '') {
  return {
    patient_id: patientId || questionMetadata.patientId || '',
    current_hypothesis: currentHypothesis || questionMetadata.currentHypothesis || '',
    lesion_location: questionMetadata.location || questionMetadata.lesionLocation || '',
    diagnosis: questionMetadata.diagnosis || '',
    age_group: questionMetadata.ageGroup || '',
    sex: questionMetadata.sex || '',
    skin_tone: questionMetadata.skinTone || '',
  };
}

export function parseSecondOpinionCaption(post) {
  const lines = [post.question_text || ''];
  const metadata = [];
  if (post.lesion_location) metadata.push(`Location: ${post.lesion_location}`);
  if (post.diagnosis) metadata.push(`Diagnosis: ${post.diagnosis}`);
  if (post.age_group) metadata.push(`Age Group: ${post.age_group}`);
  if (post.sex) metadata.push(`Sex: ${post.sex}`);
  if (post.skin_tone) metadata.push(`Skin Tone: ${post.skin_tone}`);
  if (post.patient_id) metadata.push(`Patient ID: ${post.patient_id}`);
  if (post.current_hypothesis) metadata.push(`Hypothesis: ${post.current_hypothesis}`);
  if (metadata.length > 0) {
    lines.push(metadata.join(' | '));
  }
  return lines.filter(Boolean).join('\n\n');
}

export function normalizeSecondOpinionPost(post) {
  return {
    id: post.id,
    doctorName: post.doctor_name || 'Doctor',
    affiliation: post.doctor_affiliation || '',
    caption: parseSecondOpinionCaption(post),
    uploads: (post.image_urls || []).map((url, index) => ({ id: index, preview: url })),
    comments: (post.comments || []).map((comment) => ({
      id: comment.id,
      text: comment.comment_text,
      author: comment.author_name || 'Anonymous Doctor',
    })),
    posted: post.status !== 'draft',
    raw: post,
  };
}

export async function fetchSecondOpinionPosts() {
  const posts = await request('/second-opinion/posts');
  return posts.map(normalizeSecondOpinionPost);
}

export async function createSecondOpinionPost(payload) {
  return request('/second-opinion/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createSecondOpinionComment(postId, payload) {
  return request(`/second-opinion/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteSecondOpinionPost(postId) {
  return request(`/second-opinion/posts/${postId}`, {
    method: 'DELETE',
  });
}
