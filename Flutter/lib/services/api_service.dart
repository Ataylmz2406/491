import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

class ApiService {
  // For macOS simulator, use localhost. For physical device, use machine IP
  static const String baseUrl = 'http://localhost:8000';

  static Future<Map<String, dynamic>> predict({
    required File dermoscopicImage,
    File? clinicalImage,
    String? lesionLocation,
    String? diagnosis,
  }) async {
    final uri = Uri.parse('$baseUrl/predict');
    final request = http.MultipartRequest('POST', uri);

    // Add dermoscopic image with explicit content-type
    final dermBytes = await dermoscopicImage.readAsBytes();
    request.files.add(
      http.MultipartFile.fromBytes(
        'dermoscopic_image',
        dermBytes,
        filename: 'image.jpg',
        contentType: MediaType('image', 'jpeg'),
      ),
    );

    // Add clinical image if provided
    if (clinicalImage != null) {
      final clinBytes = await clinicalImage.readAsBytes();
      request.files.add(
        http.MultipartFile.fromBytes(
          'clinical_image',
          clinBytes,
          filename: 'clinical.jpg',
          contentType: MediaType('image', 'jpeg'),
        ),
      );
    }

    if (lesionLocation != null && lesionLocation.isNotEmpty) {
      request.fields['lesion_location'] = lesionLocation;
    }

    if (diagnosis != null && diagnosis.isNotEmpty) {
      request.fields['diagnosis'] = diagnosis;
    }

    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    } else {
      throw Exception(
        'API hatası: ${response.statusCode} - ${response.body}',
      );
    }
  }
}
