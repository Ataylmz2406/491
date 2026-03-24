import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_service.dart';
import '../services/patient_history_service.dart';
import 'patient_history.dart';
import 'second_opinion.dart';

// Class name mapping
const Map<String, String> CLASS_NAME_MAP = {
  "AKIEC": "Actinic keratosis / intraepidermal carcinoma",
  "BCC": "Basal cell carcinoma",
  "BEN_OTH": "Other benign proliferations",
  "BKL": "Benign keratinocytic lesion",
  "DF": "Dermatofibroma",
  "INF": "Inflammatory and infectious conditions",
  "MAL_OTH": "Other malignant proliferations",
  "MEL": "Melanoma",
  "NV": "Melanocytic nevus",
  "SCCKA": "Squamous cell carcinoma / keratoacanthoma",
  "VASC": "Vascular lesions and hemorrhage"
};

// Malignant classes
const Set<String> MALIGNANT_CLASSES = {'MEL', 'BCC', 'SCCKA', 'AKIEC', 'MAL_OTH'};

class AnalysisPage extends StatefulWidget {
  final String userType;

  const AnalysisPage({super.key, required this.userType});

  @override
  State<AnalysisPage> createState() => _AnalysisPageState();
}

class _AnalysisPageState extends State<AnalysisPage> {
  final ImagePicker picker = ImagePicker();

  File? dermoscopicImage;
  File? clinicalImage;

  // Dropdown options
  static const List<String> lesionLocations = [
    'Head',
    'Neck',
    'Chest',
    'Back',
    'Upper arm',
    'Right forearm',
    'Left forearm',
    'Hand',
    'Hip',
    'Abdomen',
    'Upper leg',
    'Lower leg',
    'Foot',
    'Other'
  ];

  static const List<String> diagnosisOptions = [
    'Actinic keratosis',
    'Basal cell carcinoma',
    'Benign nevus',
    'Dermatofibroma',
    'Melanoma',
    'Squamous cell carcinoma',
    'Vascular lesion',
    'Other'
  ];

  static const List<String> ageGroups = [
    '0-10',
    '10-20',
    '20-30',
    '30-40',
    '40-50',
    '50-60',
    '60-70',
    '70+'
  ];

  static const List<String> sexOptions = [
    'Male',
    'Female',
    'Other'
  ];

  static const List<String> skinTones = [
    'Type I (Very Fair)',
    'Type II (Fair)',
    'Type III (Medium)',
    'Type IV (Tan)',
    'Type V (Deep Brown)',
    'Type VI (Dark)'
  ];

  // Selected values
  String? selectedLocation;
  String? selectedDiagnosis;
  String? selectedAgeGroup;
  String? selectedSex;
  String? selectedSkinTone;

  // Controllers (for backward compatibility)
  final TextEditingController locationController = TextEditingController();
  final TextEditingController diagnosisController = TextEditingController();
  final TextEditingController ageGroupController = TextEditingController();
  final TextEditingController sexController = TextEditingController();
  final TextEditingController skinToneController = TextEditingController();

  bool isLoading = false;
  String? errorMessage;
  Map<String, dynamic>? result;

  bool includeClinicalImage = false;
  bool showPatientHistory = false;

  String activeTab = 'analysis'; // analysis | secondOpinion

  Future<void> pickImage({required bool isDermoscopic}) async {
    try {
      final XFile? image = await picker.pickImage(source: ImageSource.gallery);

      if (image != null) {
        setState(() {
          if (isDermoscopic) {
            dermoscopicImage = File(image.path);
          } else {
            clinicalImage = File(image.path);
          }
          result = null;
          errorMessage = null;
        });
      }
    } catch (e) {
      setState(() {
        errorMessage = 'Görsel seçme hatası: $e';
      });
    }
  }

  void removeImage({required bool isDermoscopic}) {
    setState(() {
      if (isDermoscopic) {
        dermoscopicImage = null;
        includeClinicalImage = false;
        clinicalImage = null;
      } else {
        clinicalImage = null;
      }
      result = null;
      errorMessage = null;
    });
  }

  Future<void> runAnalysis() async {
    if (dermoscopicImage == null) {
      setState(() {
        errorMessage = 'Dermoscopic image is required for analysis.';
      });
      return;
    }

    setState(() {
      isLoading = true;
      errorMessage = null;
      result = null;
    });

    try {
      final response = await ApiService.predict(
        dermoscopicImage: dermoscopicImage!,
        lesionLocation: locationController.text.trim(),
        diagnosis: diagnosisController.text.trim(),
      );

      setState(() {
        result = response;
      });
    } catch (e) {
      setState(() {
        errorMessage = 'Analiz hatası: $e';
      });
    } finally {
      setState(() {
        isLoading = false;
      });
    }
  }

  void openPatientHistoryDialog() {
    final questionMetadata = {
      'location': locationController.text,
      'diagnosis': diagnosisController.text,
      'ageGroup': ageGroupController.text,
      'sex': sexController.text,
      'skinTone': skinToneController.text,
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

  String getFullClassName(String abbr) {
    return CLASS_NAME_MAP[abbr] ?? abbr;
  }

  void copyClinicalNote() {
    if (result == null) return;
    
    final prediction = result?['prediction'];
    final confidence = result?['confidence_score'];
    final zoomCheck = result?['metadata']?['zoom_check'];
    
    final note = '''SUDerm CLINICAL REPORT - SABANCI UNIVERSITY
Location: ${locationController.text.isEmpty ? "Unspecified" : locationController.text}
Image Status: ${zoomCheck != null && zoomCheck != 'OK' && zoomCheck != 'N/A' ? "Warning: Low Res/Square" : "Validated"}
AI Assessment: $prediction (${confidence?.toStringAsFixed(1)}% Confidence)
Top Differential: ${result?['details']?['top_class']}''';
    
    Clipboard.setData(ClipboardData(text: note));
    
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Clinical note copied to clipboard')),
    );
  }

  Future<void> saveToPatientHistory() async {
    if (result == null) return;

    try {
      final prediction = result?['prediction'] ?? 'Unknown';
      final confidence = (result?['confidence_score'] ?? 0).toDouble();
      final location = locationController.text.trim();

      final diagnosis = DiagnosisRecord(
        id: await PatientHistoryService.getNextId(),
        date: DateTime.now(),
        diagnosis: prediction,
        confidence: confidence,
        location: location.isEmpty ? 'Unspecified' : location,
        status: 'Monitoring', // Default status for new diagnoses
      );

      await PatientHistoryService.saveDiagnosis(diagnosis);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Diagnosis saved to patient history')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error saving diagnosis: $e')),
        );
      }
    }
  }

  bool isMalignantPrediction(String prediction) {
    return prediction.toLowerCase().contains('malignant') || 
           prediction.toLowerCase().contains('risk');
  }

  Color getResultColor(String prediction) {
    if (isMalignantPrediction(prediction)) {
      return const Color(0xFFDC2626);
    }
    return const Color(0xFF16A34A);
  }

  Widget buildDropdownField({
    required String label,
    required String? value,
    required List<String> items,
    required Function(String?) onChanged,
    IconData? icon,
  }) {
    return DropdownButtonFormField<String>(
      value: value,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: icon != null ? Icon(icon, color: const Color(0xFF0D9488)) : null,
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF0D9488), width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 14),
        floatingLabelBehavior: FloatingLabelBehavior.auto,
      ),
      items: items.map((String item) {
        return DropdownMenuItem<String>(
          value: item,
          child: Text(item),
        );
      }).toList(),
      onChanged: onChanged,
      isExpanded: true,
      hint: Text(label),
    );
  }

  Widget buildTextField({
    required TextEditingController controller,
    required String label,
    IconData? icon,
  }) {
    return TextField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: icon != null ? Icon(icon, color: const Color(0xFF0D9488)) : null,
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF0D9488), width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 14),
        floatingLabelBehavior: FloatingLabelBehavior.auto,
      ),
    );
  }

  Widget buildImageCard({
    required String title,
    required File? imageFile,
    required VoidCallback onPick,
    required VoidCallback onRemove,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFE5E7EB)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            height: 190,
            decoration: BoxDecoration(
              color: const Color(0xFFF3F4F6),
              borderRadius: BorderRadius.circular(12),
            ),
            child: imageFile != null
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.file(imageFile, fit: BoxFit.cover),
                  )
                : const Center(
                    child: Text(
                      'No image selected',
                      style: TextStyle(color: Colors.grey),
                    ),
                  ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: onPick,
                  child: const Text('Select Image'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: imageFile != null ? onRemove : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.redAccent,
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Remove'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget buildHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(
          bottom: BorderSide(color: Color(0xFFE5E7EB)),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  activeTab == 'analysis'
                      ? 'New Analysis Session'
                      : 'Second Opinion',
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1F2937),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  activeTab == 'analysis'
                      ? 'Upload imagery to initialize the analysis process.'
                      : 'Submit your second-opinion images and comments.',
                  style: const TextStyle(
                    fontSize: 14,
                    color: Color(0xFF6B7280),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'User Type: ${widget.userType}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF4B5563),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Row(
            children: [
              if (widget.userType == 'doctor' || widget.userType == 'personal')
                Padding(
                  padding: const EdgeInsets.only(right: 12),
                  child: ElevatedButton(
                    onPressed: openPatientHistoryDialog,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0D9488),
                      foregroundColor: Colors.white,
                    ),
                    child: const Text('Patient History'),
                  ),
                ),
              if (widget.userType == 'doctor') ...[
                _tabButton(
                  title: 'Analysis',
                  selected: activeTab == 'analysis',
                  onTap: () {
                    setState(() {
                      activeTab = 'analysis';
                    });
                  },
                ),
                const SizedBox(width: 8),
                _tabButton(
                  title: 'Second Opinion',
                  selected: activeTab == 'secondOpinion',
                  onTap: () {
                    setState(() {
                      activeTab = 'secondOpinion';
                    });
                  },
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _tabButton({
    required String title,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return ElevatedButton(
      onPressed: onTap,
      style: ElevatedButton.styleFrom(
        backgroundColor:
            selected ? const Color(0xFF4F46E5) : const Color(0xFFF3F4F6),
        foregroundColor: selected ? Colors.white : const Color(0xFF374151),
        elevation: 0,
      ),
      child: Text(title),
    );
  }

  Widget buildSidebarPanel() {
    return Container(
      width: 340,
      padding: const EdgeInsets.all(24),
      decoration: const BoxDecoration(
        color: Color(0xFFF9FAFB),
        border: Border(
          right: BorderSide(color: Color(0xFFE5E7EB)),
        ),
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Patient Information',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Color(0xFF111827),
              ),
            ),
            const SizedBox(height: 20),
            buildDropdownField(
              label: 'Lesion Location',
              value: selectedLocation,
              items: lesionLocations,
              icon: Icons.location_on_rounded,
              onChanged: (String? newValue) {
                setState(() {
                  selectedLocation = newValue;
                  locationController.text = newValue ?? '';
                });
              },
            ),
            const SizedBox(height: 16),
            buildDropdownField(
              label: 'Diagnosis',
              value: selectedDiagnosis,
              items: diagnosisOptions,
              icon: Icons.medical_information_rounded,
              onChanged: (String? newValue) {
                setState(() {
                  selectedDiagnosis = newValue;
                  diagnosisController.text = newValue ?? '';
                });
              },
            ),
            const SizedBox(height: 20),
            const Divider(),
            const SizedBox(height: 20),
            const Text(
              'Demographics',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Color(0xFF6B7280),
              ),
            ),
            const SizedBox(height: 16),
            buildDropdownField(
              label: 'Age Group',
              value: selectedAgeGroup,
              items: ageGroups,
              icon: Icons.person_rounded,
              onChanged: (String? newValue) {
                setState(() {
                  selectedAgeGroup = newValue;
                  ageGroupController.text = newValue ?? '';
                });
              },
            ),
            const SizedBox(height: 16),
            buildDropdownField(
              label: 'Sex',
              value: selectedSex,
              items: sexOptions,
              icon: Icons.wc_rounded,
              onChanged: (String? newValue) {
                setState(() {
                  selectedSex = newValue;
                  sexController.text = newValue ?? '';
                });
              },
            ),
            const SizedBox(height: 16),
            buildDropdownField(
              label: 'Skin Tone',
              value: selectedSkinTone,
              items: skinTones,
              icon: Icons.palette_rounded,
              onChanged: (String? newValue) {
                setState(() {
                  selectedSkinTone = newValue;
                  skinToneController.text = newValue ?? '';
                });
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget buildAnalysisContent() {
    return Expanded(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1100),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 4,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      buildImageCard(
                        title: 'Dermoscopic Image',
                        imageFile: dermoscopicImage,
                        onPick: () => pickImage(isDermoscopic: true),
                        onRemove: () => removeImage(isDermoscopic: true),
                      ),
                      const SizedBox(height: 16),
                      if (dermoscopicImage != null &&
                          widget.userType != 'personal')
                        CheckboxListTile(
                          value: includeClinicalImage,
                          contentPadding: EdgeInsets.zero,
                          title: const Text('Include clinical image'),
                          onChanged: (value) {
                            setState(() {
                              includeClinicalImage = value ?? false;
                              if (!includeClinicalImage) {
                                clinicalImage = null;
                              }
                            });
                          },
                        ),
                      if (includeClinicalImage && widget.userType != 'personal')
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: buildImageCard(
                            title: 'Clinical Image',
                            imageFile: clinicalImage,
                            onPick: () => pickImage(isDermoscopic: false),
                            onRemove: () => removeImage(isDermoscopic: false),
                          ),
                        ),
                      const SizedBox(height: 20),
                      const Text(
                        'Ensure images are high-resolution and focused.',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF9CA3AF),
                        ),
                      ),
                      const SizedBox(height: 8),
                      if (widget.userType == 'personal')
                        const Text(
                          'Please consult a medical professional after use.',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.red,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      const SizedBox(height: 16),
                      SizedBox(
                        height: 52,
                        child: ElevatedButton(
                          onPressed: isLoading ? null : runAnalysis,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0F172A),
                            foregroundColor: Colors.white,
                          ),
                          child: Text(
                            isLoading ? 'Processing...' : 'Run Diagnostics',
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                      if (errorMessage != null) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF2F2),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: const Color(0xFFFECACA),
                            ),
                          ),
                          child: Text(
                            errorMessage!,
                            style: const TextStyle(color: Colors.red),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 24),
                Expanded(
                  flex: 5,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (result == null)
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF9FAFB),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: const Color(0xFFE5E7EB),
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Dermoscopic Examples',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF6B7280),
                                ),
                              ),
                              const SizedBox(height: 12),
                              Container(
                                height: 140,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFE5E7EB),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Center(
                                  child: Text('Sample image placeholder'),
                                ),
                              ),
                              const SizedBox(height: 8),
                              const Text(
                                '(a)(b) benign · (c)(d) malignant',
                                style: TextStyle(
                                  fontSize: 10,
                                  color: Color(0xFF9CA3AF),
                                ),
                              ),
                            ],
                          ),
                        ),
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFE5E7EB)),
                        ),
                        child: result == null
                            ? const Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Diagnosis Result',
                                    style: TextStyle(
                                      fontSize: 20,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  SizedBox(height: 12),
                                  Text('No result yet. Run diagnostics first.'),
                                ],
                              )
                            : SingleChildScrollView(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        const Text(
                                          'Diagnosis Result',
                                          style: TextStyle(
                                            fontSize: 20,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                        Row(
                                          children: [
                                            ElevatedButton.icon(
                                              onPressed: saveToPatientHistory,
                                              icon: const Icon(Icons.save, size: 16),
                                              label: const Text('Save History'),
                                              style: ElevatedButton.styleFrom(
                                                backgroundColor: const Color(0xFF0D9488),
                                                foregroundColor: Colors.white,
                                                padding: const EdgeInsets.symmetric(
                                                  horizontal: 12,
                                                  vertical: 8,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            ElevatedButton.icon(
                                              onPressed: copyClinicalNote,
                                              icon: const Icon(Icons.copy, size: 16),
                                              label: const Text('Copy Note'),
                                              style: ElevatedButton.styleFrom(
                                                backgroundColor: const Color(0xFF6B7280),
                                                foregroundColor: Colors.white,
                                                padding: const EdgeInsets.symmetric(
                                                  horizontal: 12,
                                                  vertical: 8,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 14),
                                    // Unified Prediction Display
                                    Container(
                                      padding: const EdgeInsets.all(14),
                                      decoration: BoxDecoration(
                                        color: isMalignantPrediction(result?['prediction'] ?? '')
                                            ? const Color(0xFFFEE2E2)
                                            : const Color(0xFFF0FDF4),
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(
                                          color: isMalignantPrediction(result?['prediction'] ?? '')
                                              ? const Color(0xFFFECACA)
                                              : const Color(0xFFDCFCE7),
                                        ),
                                      ),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Icon(
                                                isMalignantPrediction(result?['prediction'] ?? '')
                                                    ? Icons.warning_rounded
                                                    : Icons.check_circle_rounded,
                                                color: getResultColor(
                                                  result?['prediction'] ?? '',
                                                ),
                                                size: 28,
                                              ),
                                              const SizedBox(width: 12),
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    const Text(
                                                      'AI PREDICTION',
                                                      style: TextStyle(
                                                        fontSize: 11,
                                                        fontWeight: FontWeight.bold,
                                                        color: Color(0xFF6B7280),
                                                      ),
                                                    ),
                                                    const SizedBox(height: 4),
                                                    Text(
                                                      result?['prediction'] ?? 'Unknown',
                                                      style: TextStyle(
                                                        fontSize: 15,
                                                        fontWeight: FontWeight.bold,
                                                        color: getResultColor(
                                                          result?['prediction'] ?? '',
                                                        ),
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                              Column(
                                                crossAxisAlignment: CrossAxisAlignment.end,
                                                children: [
                                                  const Text(
                                                    'CONFIDENCE',
                                                    style: TextStyle(
                                                      fontSize: 11,
                                                      fontWeight: FontWeight.bold,
                                                      color: Color(0xFF6B7280),
                                                    ),
                                                  ),
                                                  const SizedBox(height: 4),
                                                  Text(
                                                    '${(result?['confidence_score'] ?? 0).toStringAsFixed(1)}%',
                                                    style: const TextStyle(
                                                      fontSize: 15,
                                                      fontWeight: FontWeight.bold,
                                                      color: Color(0xFF1F2937),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(height: 14),
                                    // Top Class Display
                                    Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF9F5FF),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Text(
                                            'Top Differential Class',
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.bold,
                                              color: Color(0xFF6B7280),
                                            ),
                                          ),
                                          const SizedBox(height: 6),
                                          Text(
                                            getFullClassName(result?['details']?['top_class'] ?? ''),
                                            style: const TextStyle(
                                              fontSize: 14,
                                              fontWeight: FontWeight.w600,
                                              color: Color(0xFF7C3AED),
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            '${(result?['details']?['top_prob'] ?? 0).toStringAsFixed(1)}% confidence',
                                            style: const TextStyle(
                                              fontSize: 12,
                                              color: Color(0xFF9CA3AF),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(height: 14),
                                    // All Predictions
                                    const Text(
                                      'All Predictions',
                                      style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Column(
                                      children: [
                                        ...((result?['details']?['all_predictions'] ?? []) as List)
                                            .map((pred) {
                                          final className = pred['class'] as String;
                                          final prob = (pred['prob'] ?? 0.0) as num;
                                          final isMalignant = MALIGNANT_CLASSES.contains(className);
                                          
                                          return Padding(
                                            padding: const EdgeInsets.only(bottom: 8),
                                            child: Row(
                                              crossAxisAlignment: CrossAxisAlignment.center,
                                              children: [
                                                Expanded(
                                                  child: Column(
                                                    crossAxisAlignment: CrossAxisAlignment.start,
                                                    children: [
                                                      Text(
                                                        className,
                                                        style: TextStyle(
                                                          fontSize: 13,
                                                          fontWeight: FontWeight.w600,
                                                          color: isMalignant
                                                              ? const Color(0xFFDC2626)
                                                              : const Color(0xFF16A34A),
                                                        ),
                                                      ),
                                                      const SizedBox(height: 2),
                                                      Text(
                                                        getFullClassName(className),
                                                        style: const TextStyle(
                                                          fontSize: 11,
                                                          color: Color(0xFF9CA3AF),
                                                        ),
                                                        maxLines: 1,
                                                        overflow: TextOverflow.ellipsis,
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                                const SizedBox(width: 12),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(
                                                    horizontal: 8,
                                                    vertical: 4,
                                                  ),
                                                  decoration: BoxDecoration(
                                                    color: isMalignant
                                                        ? const Color(0xFFFEE2E2)
                                                        : const Color(0xFFF0FDF4),
                                                    borderRadius: BorderRadius.circular(6),
                                                  ),
                                                  child: Text(
                                                    '${prob.toStringAsFixed(1)}%',
                                                    style: TextStyle(
                                                      fontSize: 12,
                                                      fontWeight: FontWeight.bold,
                                                      color: isMalignant
                                                          ? const Color(0xFFDC2626)
                                                          : const Color(0xFF16A34A),
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          );
                                        }),
                                      ],
                                    ),
                                    if (result?['metadata']?['zoom_check'] != null &&
                                        result?['metadata']?['zoom_check'] != 'OK' &&
                                        result?['metadata']?['zoom_check'] != 'N/A') ...[
                                      const SizedBox(height: 14),
                                      Container(
                                        padding: const EdgeInsets.all(12),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFFEF3C7),
                                          borderRadius: BorderRadius.circular(10),
                                          border: Border.all(
                                            color: const Color(0xFFFCD34D),
                                          ),
                                        ),
                                        child: Row(
                                          children: [
                                            const Icon(
                                              Icons.info_outlined,
                                              color: Color(0xFFB45309),
                                              size: 20,
                                            ),
                                            const SizedBox(width: 8),
                                            Expanded(
                                              child: Text(
                                                result?['metadata']?['zoom_check'] ?? '',
                                                style: const TextStyle(
                                                  fontSize: 12,
                                                  color: Color(0xFFB45309),
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget buildSecondOpinionContent() {
    return Expanded(
      child: SecondOpinionPage(
        doctorName: 'Dr. Alice Example',
        doctorAffiliation: 'Dermatology Dept.',
        questionMetadata: {
          'location': locationController.text,
          'diagnosis': diagnosisController.text,
          'ageGroup': ageGroupController.text,
          'sex': sexController.text,
          'skinTone': skinToneController.text,
        },
      ),
    );
  }

  @override
  void dispose() {
    locationController.dispose();
    diagnosisController.dispose();
    ageGroupController.dispose();
    sexController.dispose();
    skinToneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: SafeArea(
        child: Column(
          children: [
            buildHeader(),
            Expanded(
              child: Row(
                children: [
                  buildSidebarPanel(),
                  activeTab == 'analysis'
                      ? buildAnalysisContent()
                      : buildSecondOpinionContent(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}