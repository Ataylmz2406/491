import 'package:flutter/material.dart';

class AppLocalizations {
  final Locale locale;

  AppLocalizations(this.locale);

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  // Landing Page Strings
  String get appTitle => locale.languageCode == 'tr' ? 'SUDerm' : 'SUDerm';
  
  String get subtitle => locale.languageCode == 'tr'
      ? 'Akıllı Cilt Lezyonu Analizi'
      : 'Intelligent Skin Lesion Analysis';

  String get description => locale.languageCode == 'tr'
      ? 'Sabancı Üniversitesi araştırmalarıyla desteklenen yapay zeka destekli dermatolojik analiz için role göre seçim yapınız. Doğru değerlendirmeler ve profesyonel öneriler alınız.'
      : 'Select your role to access AI-powered dermatological analysis powered by Sabanci University research. Get accurate assessments and professional insights.';

  String get selectYourRole => locale.languageCode == 'tr'
      ? 'Rolünüzü Seçiniz'
      : 'Select Your Role';

  String get forDoctors => locale.languageCode == 'tr' ? 'Doktorlar İçin' : 'For Doctors';

  String get doctorDescription => locale.languageCode == 'tr'
      ? 'Gelişmiş tanı araçlarına erişin ve hastalarınız için ikinci fikir özelliğini kullanın.'
      : 'Access advanced diagnostic tools and get second opinion features for your patients.';

  String get forResearchers => locale.languageCode == 'tr' ? 'Araştırmacılar İçin' : 'For Researchers';

  String get researcherDescription => locale.languageCode == 'tr'
      ? 'Dermoskopik verileri analiz edin ve araştırma projelerinde işbirliği yapın.'
      : 'Analyze dermoscopic data and collaborate on research projects.';

  String get personalUse => locale.languageCode == 'tr' ? 'Kişisel Kullanım' : 'Personal Use';

  String get personalDescription => locale.languageCode == 'tr'
      ? 'Kişisel referans için ön cilt lezyonu değerlendirmesi alınız.'
      : 'Get preliminary skin lesion assessments for personal reference.';

  String get getStarted => locale.languageCode == 'tr' ? 'Başla' : 'Get Started';

  // Login Page Strings
  String get login => locale.languageCode == 'tr' ? 'Giriş Yap' : 'Login';

  String get doctorLogin =>
      locale.languageCode == 'tr' ? 'Doktor Giriş' : 'Doctor Login';

  String get doctorLoginSubtitle => locale.languageCode == 'tr'
      ? 'Gelişmiş tanı araçlarına erişin'
      : 'Access advanced diagnostic tools';

  String get researcherLogin =>
      locale.languageCode == 'tr' ? 'Araştırmacı Giriş' : 'Researcher Login';

  String get researcherLoginSubtitle => locale.languageCode == 'tr'
      ? 'Araştırma verilerini analiz edin'
      : 'Analyze research data';

  String get personalLogin =>
      locale.languageCode == 'tr' ? 'Kişisel Kullanım' : 'Personal Use';

  String get personalLoginSubtitle => locale.languageCode == 'tr'
      ? 'Ön değerlendirmeler alınız'
      : 'Get preliminary assessments';

  String get hospitalId =>
      locale.languageCode == 'tr' ? 'Hastane Kimliği' : 'Hospital ID';

  String get hospitalIdRequired => locale.languageCode == 'tr'
      ? 'Hastane Kimliği gereklidir'
      : 'Hospital ID is required';

  String get doctorId =>
      locale.languageCode == 'tr' ? 'Doktor Kimliği' : 'Doctor ID';

  String get doctorIdRequired => locale.languageCode == 'tr'
      ? 'Doktor Kimliği gereklidir'
      : 'Doctor ID is required';

  String get email =>
      locale.languageCode == 'tr' ? 'E-posta' : 'Email';

  String get emailRequired => locale.languageCode == 'tr'
      ? 'E-posta gereklidir'
      : 'Email is required';

  String get invalidEmail => locale.languageCode == 'tr'
      ? 'Geçerli bir e-posta girin'
      : 'Enter a valid email';

  String get password =>
      locale.languageCode == 'tr' ? 'Şifre' : 'Password';

  String get passwordRequired => locale.languageCode == 'tr'
      ? 'Şifre gereklidir'
      : 'Password is required';

  String get signIn => locale.languageCode == 'tr' ? 'Giriş Yap' : 'Sign In';

  String get or => locale.languageCode == 'tr' ? 'Ya da' : 'Or';

  String get continueAsGuest =>
      locale.languageCode == 'tr' ? 'Konuk Olarak Devam Et' : 'Continue as Guest';

  String get backToRoles => locale.languageCode == 'tr'
      ? 'Rollere Dön'
      : 'Back to Roles';

  String get guestAccess => locale.languageCode == 'tr' ? 'Konuk Erişimi' : 'Guest Access';

  // Analysis Page Strings
  String get analysis => locale.languageCode == 'tr' ? 'Analiz' : 'Analysis';

  String get uploadImage =>
      locale.languageCode == 'tr' ? 'Resim Yükle' : 'Upload Image';

  String get analyze =>
      locale.languageCode == 'tr' ? 'Analiz Et' : 'Analyze';

  String get results => locale.languageCode == 'tr' ? 'Sonuçlar' : 'Results';

  String get patientHistory =>
      locale.languageCode == 'tr' ? 'Hasta Geçmişi' : 'Patient History';

  String get secondOpinion =>
      locale.languageCode == 'tr' ? 'İkinci Fikir' : 'Second Opinion';

  // Language Selection
  String get english => 'English';

  String get turkish => 'Türkçe';

  String get selectLanguage => locale.languageCode == 'tr'
      ? 'Dil Seçiniz'
      : 'Select Language';
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) {
    return ['en', 'tr'].contains(locale.languageCode);
  }

  @override
  Future<AppLocalizations> load(Locale locale) {
    return Future.value(AppLocalizations(locale));
  }

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}
