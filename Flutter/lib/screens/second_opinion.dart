import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'patient_history.dart';

// Data models
class ImageUpload {
  final int id;
  final File file;
  final String preview;

  ImageUpload({
    required this.id,
    required this.file,
    required this.preview,
  });
}

class OpinionPost {
  final int id;
  final List<ImageUpload> uploads;
  final String notes;
  final List<String> comments;
  final bool posted;

  OpinionPost({
    required this.id,
    required this.uploads,
    required this.notes,
    required this.comments,
    required this.posted,
  });

  OpinionPost copyWith({
    List<ImageUpload>? uploads,
    String? notes,
    List<String>? comments,
    bool? posted,
  }) {
    return OpinionPost(
      id: id,
      uploads: uploads ?? this.uploads,
      notes: notes ?? this.notes,
      comments: comments ?? this.comments,
      posted: posted ?? this.posted,
    );
  }
}

const Map<String, String> DIAGNOSIS_OPTIONS = {
  'AKIEC': 'Actinic keratosis / intraepidermal carcinoma',
  'BCC': 'Basal cell carcinoma',
  'BEN_OTH': 'Other benign proliferations',
  'BKL': 'Benign keratinocytic lesion',
  'DF': 'Dermatofibroma',
  'INF': 'Inflammatory and infectious conditions',
  'MAL_OTH': 'Other malignant proliferations',
  'MEL': 'Melanoma',
  'NV': 'Melanocytic nevus',
  'SCCKA': 'Squamous cell carcinoma / keratoacanthoma',
  'VASC': 'Vascular lesions and hemorrhage',
};

class SecondOpinionPage extends StatefulWidget {
  final String doctorName;
  final String doctorAffiliation;
  final Map<String, dynamic>? questionMetadata;

  const SecondOpinionPage({
    super.key,
    required this.doctorName,
    required this.doctorAffiliation,
    this.questionMetadata,
  });

  @override
  State<SecondOpinionPage> createState() => _SecondOpinionPageState();
}

class _SecondOpinionPageState extends State<SecondOpinionPage> {
  final ImagePicker picker = ImagePicker();
  final TextEditingController patientIdController = TextEditingController();
  final TextEditingController commentController = TextEditingController();
  String aiPrediction = '';
  List<OpinionPost> posts = [];
  int imageIdCounter = 0;

  void handleFileAdd() async {
    try {
      final List<XFile>? images = await picker.pickMultiImage();
      if (images != null && images.isNotEmpty) {
        OpinionPost? lastUnpostedPost;
        int lastIndex = -1;

        for (int i = posts.length - 1; i >= 0; i--) {
          if (!posts[i].posted) {
            lastUnpostedPost = posts[i];
            lastIndex = i;
            break;
          }
        }

        final newUploads = images.map((image) {
          imageIdCounter++;
          return ImageUpload(
            id: imageIdCounter,
            file: File(image.path),
            preview: image.path,
          );
        }).toList();

        if (lastUnpostedPost != null) {
          final updatedUploads = [...lastUnpostedPost.uploads, ...newUploads];
          posts[lastIndex] = lastUnpostedPost.copyWith(uploads: updatedUploads);
        } else {
          posts.add(OpinionPost(
            id: DateTime.now().millisecondsSinceEpoch,
            uploads: newUploads,
            notes: '',
            comments: [],
            posted: false,
          ));
        }
        setState(() {});
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error picking images: $e')),
      );
    }
  }

  void updateNotes(int postId, String text) {
    final index = posts.indexWhere((p) => p.id == postId);
    if (index != -1) {
      posts[index] = posts[index].copyWith(notes: text);
      setState(() {});
    }
  }

  void removeUpload(int postId, int imageId) {
    final index = posts.indexWhere((p) => p.id == postId);
    if (index != -1) {
      final updatedUploads = posts[index].uploads.where((u) => u.id != imageId).toList();
      posts[index] = posts[index].copyWith(uploads: updatedUploads);
      setState(() {});
    }
  }

  void postOpinion(int postId) {
    final index = posts.indexWhere((p) => p.id == postId);
    if (index != -1) {
      posts[index] = posts[index].copyWith(posted: true);
      setState(() {});
    }
  }

  void addComment(int postId, String comment) {
    if (comment.trim().isEmpty) return;
    final index = posts.indexWhere((p) => p.id == postId);
    if (index != -1) {
      final updatedComments = [...posts[index].comments, comment.trim()];
      posts[index] = posts[index].copyWith(comments: updatedComments);
      setState(() {});
    }
  }

  void removeComment(int postId, int commentIndex) {
    final index = posts.indexWhere((p) => p.id == postId);
    if (index != -1) {
      final updatedComments = List<String>.from(posts[index].comments)
        ..removeAt(commentIndex);
      posts[index] = posts[index].copyWith(comments: updatedComments);
      setState(() {});
    }
  }

  void viewHistory() {
    final questionMetadata = {
      ...?widget.questionMetadata,
      'patientId': patientIdController.text,
      'aiPrediction': aiPrediction,
    };

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => PatientHistoryPage(
          questionMetadata: questionMetadata,
        ),
      ),
    );
  }

  @override
  void dispose() {
    patientIdController.dispose();
    commentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 900),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildDoctorInfoCard(),
              const SizedBox(height: 24),
              _buildCaseInfoCard(),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: handleFileAdd,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4F46E5),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
                icon: const Icon(Icons.upload_file),
                label: const Text('Choose Images'),
              ),
              const SizedBox(height: 24),
              if (posts.isEmpty)
                _buildEmptyState()
              else
                Column(
                  children: posts.map((post) {
                    return _buildPostCard(post);
                  }).toList(),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDoctorInfoCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Doctor Information',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Color(0xFF111827),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildReadOnlyField('Doctor Name', 'Dr. Alice Example'),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildReadOnlyField('Affiliation', 'Dermatology Dept.'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCaseInfoCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Case Information',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Color(0xFF111827),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Patient ID',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Color(0xFF6B7280),
            ),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: patientIdController,
            decoration: InputDecoration(
              hintText: 'Enter patient identifier',
              contentPadding: const EdgeInsets.all(12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'AI Prediction',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Color(0xFF6B7280),
            ),
          ),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            value: aiPrediction.isEmpty ? null : aiPrediction,
            decoration: InputDecoration(
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
              ),
            ),
            items: [
              const DropdownMenuItem(
                value: '',
                child: Text('Not specified'),
              ),
              ...DIAGNOSIS_OPTIONS.entries.map((entry) {
                return DropdownMenuItem(
                  value: entry.key,
                  child: Text(entry.value),
                );
              }).toList(),
            ],
            onChanged: (value) {
              setState(() {
                aiPrediction = value ?? '';
              });
            },
          ),
        ],
      ),
    );
  }

  Widget _buildReadOnlyField(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Color(0xFF6B7280),
          ),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: const Color(0xFFD1D5DB)),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            value,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: Color(0xFF374151),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Center(
        child: Text(
          'No opinions posted yet. Upload images to get started.',
          style: TextStyle(
            fontSize: 14,
            color: Color(0xFF9CA3AF),
          ),
        ),
      ),
    );
  }

  Widget _buildPostCard(OpinionPost post) {
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFE5E7EB)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (patientIdController.text.isNotEmpty && !post.posted)
            Align(
              alignment: Alignment.topRight,
              child: ElevatedButton(
                onPressed: viewHistory,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0D9488),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                ),
                child: const Text('History / Metadata', style: TextStyle(fontSize: 12)),
              ),
            ),
          if (post.uploads.isNotEmpty) ...[
            const SizedBox(height: 16),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1,
              ),
              itemCount: post.uploads.length,
              itemBuilder: (context, index) {
                final upload = post.uploads[index];
                return _buildImageTile(post, upload);
              },
            ),
          ],
          const SizedBox(height: 16),
          if (!post.posted) ...[
            const Text(
              'Notes',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF6B7280),
              ),
            ),
            const SizedBox(height: 6),
            TextField(
              onChanged: (value) => updateNotes(post.id, value),
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Add notes for the images...',
                contentPadding: const EdgeInsets.all(12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Align(
              alignment: Alignment.centerRight,
              child: ElevatedButton(
                onPressed: patientIdController.text.trim().isEmpty || post.uploads.isEmpty
                    ? null
                    : () => postOpinion(post.id),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4F46E5),
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: const Color(0xFFD1D5DB),
                ),
                child: const Text('Post Second Opinion'),
              ),
            ),
          ] else ...[
            const Text(
              'Notes:',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF6B7280),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              post.notes.isEmpty ? 'No notes' : post.notes,
              style: const TextStyle(
                fontSize: 14,
                color: Color(0xFF374151),
              ),
            ),
            const SizedBox(height: 20),
            const Divider(),
            const SizedBox(height: 16),
            const Text(
              'Comments',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Color(0xFF111827),
              ),
            ),
            const SizedBox(height: 12),
            _buildCommentSection(post),
          ],
        ],
      ),
    );
  }

  Widget _buildImageTile(OpinionPost post, ImageUpload upload) {
    return Stack(
      children: [
        Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: Image.file(
            upload.file,
            fit: BoxFit.cover,
          ),
        ),
        if (!post.posted)
          Positioned(
            top: 4,
            right: 4,
            child: GestureDetector(
              onTap: () => removeUpload(post.id, upload.id),
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.1),
                      blurRadius: 4,
                    ),
                  ],
                ),
                padding: const EdgeInsets.all(4),
                child: const Icon(
                  Icons.close,
                  size: 16,
                  color: Color(0xFFDC2626),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildCommentSection(OpinionPost post) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (post.comments.isNotEmpty)
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ...post.comments.asMap().entries.map((entry) {
                final idx = entry.key;
                final comment = entry.value;
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF3F4F6),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          comment,
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF374151),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: () => removeComment(post.id, idx),
                        child: const Icon(
                          Icons.close,
                          size: 16,
                          color: Color(0xFFDC2626),
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
              const SizedBox(height: 12),
            ],
          ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: commentController,
                maxLines: 2,
                minLines: 1,
                decoration: InputDecoration(
                  hintText: 'Add a comment...',
                  contentPadding: const EdgeInsets.all(12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton(
              onPressed: () {
                if (commentController.text.trim().isNotEmpty) {
                  addComment(post.id, commentController.text);
                  commentController.clear();
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4F46E5),
                foregroundColor: Colors.white,
              ),
              child: const Text('Add'),
            ),
          ],
        ),
      ],
    );
  }
}
