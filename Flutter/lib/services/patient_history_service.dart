import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_service.dart';

class DiagnosisRecord {
  final int id;
  final DateTime date;
  final String diagnosis;
  final double confidence;
  final String location;
  final String status; // 'Treated', 'Monitoring', 'No Action'
  final String? patientId;
  final String? ageGroup;
  final String? sex;
  final String? skinTone;

  DiagnosisRecord({
    required this.id,
    required this.date,
    required this.diagnosis,
    required this.confidence,
    required this.location,
    required this.status,
    this.patientId,
    this.ageGroup,
    this.sex,
    this.skinTone,
  });

  // Convert DiagnosisRecord to JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'date': date.toIso8601String(),
      'diagnosis': diagnosis,
      'confidence': confidence,
      'location': location,
      'status': status,
      'patient_id': patientId,
      'age_group': ageGroup,
      'sex': sex,
      'skin_tone': skinTone,
    };
  }

  // Create DiagnosisRecord from JSON
  factory DiagnosisRecord.fromJson(Map<String, dynamic> json) {
    return DiagnosisRecord(
      id: json['id'] as int,
      date: DateTime.parse(json['date'] as String),
      diagnosis: json['diagnosis'] as String,
      confidence: (json['confidence'] as num).toDouble(),
      location: json['location'] as String,
      status: json['status'] as String,
      patientId: json['patient_id'] as String?,
      ageGroup: json['age_group'] as String?,
      sex: json['sex'] as String?,
      skinTone: json['skin_tone'] as String?,
    );
  }
}

class PatientHistoryService {
  static Uri get _historyUri => Uri.parse('${ApiService.baseUrl}/history');

  // Load diagnosis records from backend, optionally filtered by patient id.
  static Future<List<DiagnosisRecord>> loadDiagnoses({String? patientId}) async {
    try {
      final uri = patientId == null || patientId.isEmpty
          ? _historyUri
          : _historyUri.replace(queryParameters: {'patient_id': patientId});
      final response = await http.get(uri);
      if (response.statusCode != 200) {
        throw Exception('History fetch failed: ${response.statusCode}');
      }

      final List<dynamic> jsonList = jsonDecode(response.body) as List<dynamic>;
      return jsonList
          .map((item) => DiagnosisRecord.fromJson(item as Map<String, dynamic>))
          .toList();
    } catch (e) {
      print('Error loading diagnoses: $e');
      return [];
    }
  }

  // Save a new diagnosis record
  static Future<DiagnosisRecord> saveDiagnosis(DiagnosisRecord diagnosis) async {
    try {
      final response = await http.post(
        _historyUri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(diagnosis.toJson()),
      );

      if (response.statusCode != 200) {
        throw Exception('History save failed: ${response.statusCode} - ${response.body}');
      }
      return DiagnosisRecord.fromJson(
        jsonDecode(response.body) as Map<String, dynamic>,
      );
    } catch (e) {
      print('Error saving diagnosis: $e');
      rethrow;
    }
  }

  // Delete a diagnosis record by id
  static Future<void> deleteDiagnosis(int id) async {
    try {
      final response = await http.delete(
        Uri.parse('${ApiService.baseUrl}/history/$id'),
      );

      if (response.statusCode != 200) {
        throw Exception('History delete failed: ${response.statusCode}');
      }
    } catch (e) {
      print('Error deleting diagnosis: $e');
      rethrow;
    }
  }

  // Delete all diagnoses
  static Future<void> deleteAllDiagnoses() async {
    try {
      final response = await http.delete(_historyUri);
      if (response.statusCode != 200) {
        throw Exception('History clear failed: ${response.statusCode}');
      }
    } catch (e) {
      print('Error deleting all diagnoses: $e');
      rethrow;
    }
  }

}
