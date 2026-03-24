# Flutter Mobile Application 

A professional Flutter mobile application for skin lesion analysis, providing real-time diagnostic assessment and patient history management. This application integrates with a backend AI service to deliver accurate skin disease analysis across multiple platforms.

## 🎯 Features

- **Multi-Platform Support**: Runs seamlessly on iOS, Android, Web, Windows, macOS, and Linux
- **Real-Time Skin Analysis**: Capture images and receive instant AI-powered analysis
- **Patient Management**: Store and manage patient history and medical records
- **Second Opinion System**: Consult and compare multiple diagnostic opinions
- **Multi-Language Support**: Fully localized for English and Turkish
- **Secure Authentication**: Login system with secure API integration
- **Offline Capability**: Cached data for offline access
- **Responsive Design**: Optimized UI for all screen sizes
- **Dark/Light Theme**: Material 3 design with adaptive theming

## 📋 Prerequisites

Before setting up the Flutter application, ensure you have the following installed:

- **Flutter SDK**: Version 3.11.1 or higher
  - Install from: https://flutter.dev/docs/get-started/install
  - Verify installation: `flutter --version`

- **Dart SDK**: Included with Flutter (3.11.1+)
  - Verify: `dart --version`

- **Development Tools**:
  - **For iOS**: Xcode 15.0+ (macOS only)
    ```bash
    # Install Xcode Command Line Tools
    xcode-select --install
    ```
  - **For Android**: Android Studio with SDK Platform 31+
  - **For Web**: Latest Chrome/Firefox browser
  - **For Desktop (Windows/macOS/Linux)**: Respective platform SDKs

- **Git**: For version control
  - Install from: https://git-scm.com/

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
cd path/to/your/projects
git clone https://github.com/Ataylmz2406/491.git
cd 491/Flutter
```

### 2. Get Flutter Dependencies

```bash
# Get all packages
flutter pub get

# Upgrade to latest compatible versions (optional)
flutter pub upgrade
```

### 3. Configure Build Files (First Time Only)

```bash
# Generate localization files
flutter gen-l10n

# For Android: Ensure you have local.properties configured
# For iOS: Update pod dependencies
cd ios
pod install
cd ..
```

### 4. Verify Installation

```bash
# Check Flutter setup
flutter doctor

# List connected devices
flutter devices
```

## ▶️ Running the Application

### Mobile Platforms (iOS & Android)

#### on iOS Device/Emulator
```bash
# Run on physical iOS device
flutter run -d <device_id>

# Run on iOS simulator
flutter run -d "iOS Simulator"

# Build and run with specific configuration
flutter run --flavor development --target lib/main.dart
```

#### on Android Device/Emulator
```bash
# Run on physical Android device
flutter run -d <device_id>

# Run on Android emulator
flutter run -d emulator-5554

# Build with release configuration
flutter run --release
```

### Web Platform

```bash
# Enable web support (if not already enabled)
flutter config --enable-web

# Run on web browser
flutter run -d web-server

# Build web release
flutter build web --release
```

### Desktop Platforms (Windows, macOS, Linux)

```bash
# Enable desktop support (if needed)
flutter config --enable-windows
flutter config --enable-macos
flutter config --enable-linux

# Run on desktop
flutter run -d windows  # Windows
flutter run -d macos    # macOS
flutter run -d linux    # Linux

# Build desktop release
flutter build windows --release
flutter build macos --release
flutter build linux --release
```

### Hot Reload (Development)

During development, use hot reload to see changes instantly:

```bash
# Replace 'r' to hot reload
# Replace 'R' to hot restart
```

## 📁 Project Structure

```
Flutter/
├── lib/
│   ├── main.dart                          # Application entry point
│   ├── l10n/
│   │   ├── app_localizations.dart         # Localization files
│   │   ├── app_en.arb                     # English strings
│   │   └── app_tr.arb                     # Turkish strings
│   ├── providers/
│   │   └── locale_provider.dart           # State management for language
│   ├── screens/
│   │   ├── landing_page.dart              # Home/Landing screen
│   │   ├── login_page.dart                # User authentication
│   │   ├── analysis_page.dart             # Image analysis interface
│   │   ├── patient_history.dart           # Patient records view
│   │   └── second_opinion.dart            # Multi-diagnosis comparison
│   ├── services/
│   │   ├── api_service.dart               # Backend API integration
│   │   └── patient_history_service.dart   # Patient data management
│   └── models/
│       ├── analysis_result.dart           # Analysis response model
│       └── patient.dart                   # Patient data model
│
├── test/
│   └── widget_test.dart                   # Widget testing
│
├── pubspec.yaml                           # Flutter dependencies
├── analysis_options.yaml                  # Code analysis configuration
└── README.md                              # This file
```

## 🔌 Configuration

### Environment Setup

1. **API Endpoint Configuration**
   
   Create a `lib/config/api_config.dart` file:
   ```dart
   class ApiConfig {
     static const String baseUrl = 'http://localhost:8000';
     static const int timeout = 30; // seconds
   }
   ```

2. **Update in `api_service.dart`**
   
   ```dart
   final String baseUrl = 'http://your-backend-url:8000';
   ```

### Database Configuration

The app uses `SharedPreferences` for local data storage:
- Patient history cache
- User preferences
- Localization settings

## 🌐 Localization

### Supported Languages

- **English** (en)
- **Turkish** (tr)

### Adding New Languages

1. Create new ARB file: `lib/l10n/app_xx.arb` (where `xx` is language code)
2. Add translations following the English template
3. Update `pubspec.yaml` to include new locale:
   ```yaml
   flutter_gen:
     output_class: AppLocalizations
   ```
4. Run: `flutter gen-l10n`
5. Update `main.dart` to include new locale

### Changing Language at Runtime

The app uses the `LocaleProvider` for dynamic language switching:

```dart
// Access locale provider
final localeProvider = context.read<LocaleProvider>();

// Change language
localeProvider.setLocale(const Locale('tr')); // Turkish
localeProvider.setLocale(const Locale('en')); // English
```

## 🔗 API Integration

### Backend Endpoints

The app connects to the following backend endpoints:

- **POST** `/api/auth/login` - User authentication
- **POST** `/api/analysis/predict` - Submit skin image for analysis
- **GET** `/api/patients/{id}/history` - Retrieve patient history
- **POST** `/api/patients/{id}/record` - Save analysis record
- **GET** `/api/opinions/{analysisId}` - Get second opinions

### Making API Calls

Example from `api_service.dart`:

```dart
Future<Map<String, dynamic>> analyzeImage(File imageFile) async {
  try {
    var request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/api/analysis/predict'),
    );
    
    request.files.add(
      await http.MultipartFile.fromPath('image', imageFile.path),
    );
    
    var response = await request.send();
    return json.decode(await response.stream.bytesToString());
  } catch (e) {
    throw Exception('Image analysis failed: $e');
  }
}
```

## 📦 Dependencies

### Core Framework
- **flutter** - Core Flutter framework
- **flutter_localizations** - Localization support

### UI & State Management
- **provider** (6.1.5+1) - State management solution

### API & Data
- **http** (1.2.2) - HTTP client for API calls
- **shared_preferences** (2.2.2) - Local data persistence

### Image & Media
- **image_picker** (1.1.2) - Camera/gallery image selection
- **cupertino_icons** (1.0.8) - iOS Icons

### Internationalization
- **intl** (0.20.0) - Internationalization library

## 🧪 Testing

### Run Tests

```bash
# Run all tests
flutter test

# Run specific test file
flutter test test/widget_test.dart

# Run tests with coverage
flutter test --coverage
```

### Widget Testing Example

```dart
void main() {
  testWidgets('Landing page loads', (WidgetTester tester) async {
    await tester.pumpWidget(const MyApp());
    
    expect(find.text('Welcome'), findsOneWidget);
  });
}
```

## 🔐 Security Best Practices

1. **API Keys**: Never commit sensitive data
   - Use environment variables
   - Store in secure local configuration
   
2. **Data Storage**: 
   - Use encrypted storage for sensitive patient data
   - Implement token refresh mechanism

3. **Network Security**:
   - Use HTTPS for all API calls
   - Implement certificate pinning

4. **Code Obfuscation**:
   ```bash
   flutter build apk --obfuscate --split-debug-info=build/app/outputs/symbols
   flutter build ios --obfuscate --split-debug-info=build/app/outputs/symbols
   ```

## 📱 Building for Release

### Android

```bash
# Build APK
flutter build apk --release

# Build App Bundle (for Google Play)
flutter build appbundle --release

# Output: build/app/outputs/flutter-app.apk
```

### iOS

```bash
# Build IPA
flutter build ios --release

# Output: build/ios/ipa/flutter_492.ipa
```

### Web

```bash
# Build web
flutter build web --release

# Output: build/web/
```

## 🐛 Troubleshooting

### Common Issues

#### 1. **"Flutter doctor" shows errors**
```bash
# Run doctor and fix issues
flutter doctor -v
flutter doctor --android-licenses
```

#### 2. **Pod dependency errors (iOS)**
```bash
cd ios
rm Podfile.lock
pod install --repo-update
cd ..
flutter clean
flutter pub get
```

#### 3. **Android Build Failures**
```bash
# Clean build files
flutter clean

# Rebuild
flutter pub get
flutter build apk --verbose
```

#### 4. **Hot reload not working**
- Save file properly
- Check for syntax errors
- Try hot restart (press R instead of r)

#### 5. **API Connection Errors**
- Verify backend is running: `http://localhost:8000`
- Check network connectivity
- Verify API endpoints in `api_config.dart`

#### 6. **Localization files not generating**
```bash
flutter clean
flutter pub get
flutter gen-l10n
```

## 📚 Additional Resources

- **Flutter Documentation**: https://flutter.dev/docs
- **Dart Documentation**: https://dart.dev/guides
- **Material Design 3**: https://m3.material.io/
- **Provider Package**: https://pub.dev/packages/provider
- **HTTP Package**: https://pub.dev/packages/http

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -am 'Add your feature'`
3. Push to branch: `git push origin feature/your-feature`
4. Create Pull Request

## 📝 Code Standards

- Follow [Dart Style Guide](https://dart.dev/guides/language/effective-dart/style)
- Use meaningful variable names
- Add comments for complex logic
- Write unit tests for business logic
- Keep methods concise (under 50 lines ideally)

## 📄 License

This project is part of the SUDerm (Skin Utility and Dermatology) initiative.

## 👥 Authors & Contributors

- **Team Members**: 
  - [@RaidBahadir](https://github.com/RaidBahadir)
  - [@Ataylmz2406](https://github.com/Ataylmz2406)
  - [@AlpKoca](https://github.com/AlpKoca)
  - [@erencansever](https://github.com/erencansever)

## 📧 Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Contact the development team
- Check existing documentation

---

**Last Updated**: March 2026  
**Flutter Version**: 3.11.1+  
**Status**: Active Development

