import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

class DiagnosisRecord {
  final int id;
  final DateTime date;
  final String diagnosis;
  final double confidence;
  final String location;
  final String status; // 'Treated', 'Monitoring', 'No Action'

  DiagnosisRecord({
    required this.id,
    required this.date,
    required this.diagnosis,
    required this.confidence,
    required this.location,
    required this.status,
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
    );
  }
}

class PatientHistoryService {
  static const String _storageKey = 'patient_diagnoses';

  // Load all diagnosis records from storage
  static Future<List<DiagnosisRecord>> loadDiagnoses() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonString = prefs.getString(_storageKey);

      if (jsonString == null || jsonString.isEmpty) {
        return [];
      }

      final List<dynamic> jsonList = jsonDecode(jsonString);
      return jsonList
          .map((item) => DiagnosisRecord.fromJson(item as Map<String, dynamic>))
          .toList();
    } catch (e) {
      print('Error loading diagnoses: $e');
      return [];
    }
  }

  // Save a new diagnosis record
  static Future<void> saveDiagnosis(DiagnosisRecord diagnosis) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final diagnoses = await loadDiagnoses();
      diagnoses.add(diagnosis);

      final jsonList = diagnoses.map((d) => d.toJson()).toList();
      await prefs.setString(_storageKey, jsonEncode(jsonList));
    } catch (e) {
      print('Error saving diagnosis: $e');
      rethrow;
    }
  }

  // Delete a diagnosis record by id
  static Future<void> deleteDiagnosis(int id) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final diagnoses = await loadDiagnoses();
      diagnoses.removeWhere((d) => d.id == id);

      final jsonList = diagnoses.map((d) => d.toJson()).toList();
      await prefs.setString(_storageKey, jsonEncode(jsonList));
    } catch (e) {
      print('Error deleting diagnosis: $e');
      rethrow;
    }
  }

  // Delete all diagnoses
  static Future<void> deleteAllDiagnoses() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_storageKey);
    } catch (e) {
      print('Error deleting all diagnoses: $e');
      rethrow;
    }
  }

  // Get the next available ID
  static Future<int> getNextId() async {
    final diagnoses = await loadDiagnoses();
    if (diagnoses.isEmpty) {
      return 1;
    }
    return (diagnoses.map((d) => d.id).reduce((a, b) => a > b ? a : b)) + 1;
  }
}
