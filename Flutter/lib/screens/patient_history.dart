import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/patient_history_service.dart';

// Data model for patient info
class PatientInfo {
  final String name;
  final String id;
  final DateTime dateOfBirth;
  final List<DiagnosisRecord> previousDiagnoses;

  PatientInfo({
    required this.name,
    required this.id,
    required this.dateOfBirth,
    required this.previousDiagnoses,
  });
}

class PatientHistoryPage extends StatefulWidget {
  final Map<String, dynamic>? questionMetadata;

  const PatientHistoryPage({super.key, this.questionMetadata});

  @override
  State<PatientHistoryPage> createState() => _PatientHistoryPageState();
}

class _PatientHistoryPageState extends State<PatientHistoryPage> {
  late PatientInfo patientInfo;
  List<DiagnosisRecord> diagnoses = [];

  @override
  void initState() {
    super.initState();
    _initializePatient();
    _loadDiagnoses();
  }

  void _initializePatient() {
    patientInfo = PatientInfo(
      name: 'John Mitchell',
      id: 'P-2024-001847',
      dateOfBirth: DateTime(1968, 5, 15),
      previousDiagnoses: [],
    );
  }

  Future<void> _loadDiagnoses() async {
    final String patientIdFilter =
        (widget.questionMetadata?['patientId'] ?? '').toString().trim();
    final loadedDiagnoses = await PatientHistoryService.loadDiagnoses(
      patientId: patientIdFilter.isEmpty ? null : patientIdFilter,
    );
    setState(() {
      diagnoses = loadedDiagnoses;
      patientInfo = PatientInfo(
        name: patientInfo.name,
        id: patientInfo.id,
        dateOfBirth: patientInfo.dateOfBirth,
        previousDiagnoses: diagnoses,
      );
    });
  }

  Future<void> _deleteDiagnosis(int id) async {
    await PatientHistoryService.deleteDiagnosis(id);
    _loadDiagnoses();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Diagnosis deleted')),
      );
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'Treated':
        return const Color(0xFF10B981); // Green
      case 'Monitoring':
        return const Color(0xFFF59E0B); // Amber
      case 'No Action':
        return const Color(0xFF3B82F6); // Blue
      default:
        return const Color(0xFF6B7280); // Gray
    }
  }

  Color _getStatusBgColor(String status) {
    switch (status) {
      case 'Treated':
        return const Color(0xFFDCFCE7); // Light Green
      case 'Monitoring':
        return const Color(0xFFFEF3C7); // Light Amber
      case 'No Action':
        return const Color(0xFFDEBEFC); // Light Blue
      default:
        return const Color(0xFFF3F4F6); // Light Gray
    }
  }

  bool _isMalignantDiagnosis(String diagnosis) {
    final malignantKeywords = [
      'melanoma',
      'carcinoma',
      'cancer',
      'malignant',
      'basalioma'
    ];
    return malignantKeywords
        .any((keyword) => diagnosis.toLowerCase().contains(keyword));
  }

  Color _getDiagnosisTextColor(String diagnosis) {
    return _isMalignantDiagnosis(diagnosis)
        ? const Color(0xFFDC2626) // Red for malignant
        : const Color(0xFF059669); // Green for benign
  }

  Widget _buildPatientInfoHeader() {
    final dateFormatter = DateFormat('MMMM d, yyyy');
    final age =
        DateTime.now().year - patientInfo.dateOfBirth.year -
            (DateTime.now().month < patientInfo.dateOfBirth.month ||
                    (DateTime.now().month == patientInfo.dateOfBirth.month &&
                        DateTime.now().day < patientInfo.dateOfBirth.day)
                ? 1
                : 0);

    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Patient Information',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFF111827),
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Name',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF6B7280),
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      patientInfo.name,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF111827),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Patient ID',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF6B7280),
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      patientInfo.id,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF111827),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Age / DOB',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF6B7280),
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '$age years\n${dateFormatter.format(patientInfo.dateOfBirth)}',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF111827),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildQuestionMetadataSection() {
    if (widget.questionMetadata == null) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Current Question Metadata',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Color(0xFF111827),
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 16,
            runSpacing: 12,
            children: [
              _buildMetadataItem(
                  'Location', widget.questionMetadata!['location'] ?? '—'),
              _buildMetadataItem(
                  'Diagnosis', widget.questionMetadata!['diagnosis'] ?? '—'),
              _buildMetadataItem(
                  'Age Group', widget.questionMetadata!['ageGroup'] ?? '—'),
              _buildMetadataItem('Sex', widget.questionMetadata!['sex'] ?? '—'),
              _buildMetadataItem(
                  'Skin Tone', widget.questionMetadata!['skinTone'] ?? '—'),
              _buildMetadataItem(
                  'Patient ID', widget.questionMetadata!['patientId'] ?? '—'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMetadataItem(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: Color(0xFF6B7280),
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: Color(0xFF374151),
          ),
        ),
      ],
    );
  }

  Widget _buildDiagnosisCard(DiagnosisRecord diagnosis) {
    final dateFormatter = DateFormat('MMM d, yyyy');

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      diagnosis.diagnosis,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: _getDiagnosisTextColor(diagnosis.diagnosis),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Location: ${diagnosis.location}',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF6B7280),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(
                          Icons.calendar_today,
                          size: 14,
                          color: Color(0xFF9CA3AF),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          dateFormatter.format(diagnosis.date),
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF9CA3AF),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  PopupMenuButton(
                    itemBuilder: (context) => [
                      PopupMenuItem(
                        child: const Text('Delete'),
                        onTap: () {
                          showDialog(
                            context: context,
                            builder: (context) => AlertDialog(
                              title: const Text('Delete Diagnosis'),
                              content: const Text(
                                'Are you sure you want to delete this diagnosis record?',
                              ),
                              actions: [
                                TextButton(
                                  onPressed: () => Navigator.pop(context),
                                  child: const Text('Cancel'),
                                ),
                                TextButton(
                                  onPressed: () {
                                    Navigator.pop(context);
                                    _deleteDiagnosis(diagnosis.id);
                                  },
                                  child: const Text('Delete',
                                      style: TextStyle(color: Colors.red)),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ],
                    child: const Icon(Icons.more_vert,
                        color: Color(0xFF6B7280), size: 20),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: _getStatusBgColor(diagnosis.status),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      diagnosis.status,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: _getStatusColor(diagnosis.status),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text(
                        'Confidence',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF9CA3AF),
                          letterSpacing: 0.3,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${diagnosis.confidence.toStringAsFixed(1)}%',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF111827),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D9488),
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text('Patient History'),
        centerTitle: false,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1000),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildPatientInfoHeader(),
                _buildQuestionMetadataSection(),
                const Text(
                  'Previous Diagnoses',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF111827),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '${patientInfo.previousDiagnoses.length} diagnosis records',
                  style: const TextStyle(
                    fontSize: 14,
                    color: Color(0xFF6B7280),
                  ),
                ),
                const SizedBox(height: 16),
                if (diagnoses.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF3F4F6),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Center(
                      child: Text(
                        'No previous diagnoses found.',
                        style: TextStyle(
                          fontSize: 14,
                          color: Color(0xFF9CA3AF),
                        ),
                      ),
                    ),
                  )
                else
                  Column(
                    children: diagnoses
                        .map((diagnosis) => _buildDiagnosisCard(diagnosis))
                        .toList(),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
