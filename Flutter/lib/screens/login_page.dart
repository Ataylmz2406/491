import 'package:flutter/material.dart';
import '../l10n/app_localizations.dart';

enum UserType { doctor, researcher, personal }

class LoginPage extends StatefulWidget {
  final UserType userType;
  final Function(Map<String, dynamic>) onLoginSuccess;
  final VoidCallback onBack;
  final VoidCallback onGuestAccess;

  const LoginPage({
    super.key,
    required this.userType,
    required this.onLoginSuccess,
    required this.onBack,
    required this.onGuestAccess,
  });

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  bool _showPassword = false;

  final TextEditingController emailController = TextEditingController();
  final TextEditingController passwordController = TextEditingController();
  final TextEditingController hospitalController = TextEditingController();
  final TextEditingController doctorIdController = TextEditingController();

  @override
  void dispose() {
    emailController.dispose();
    passwordController.dispose();
    hospitalController.dispose();
    doctorIdController.dispose();
    super.dispose();
  }

  void handleSubmit() {
    if (!_formKey.currentState!.validate()) return;

    final payload = <String, dynamic>{
      'userType': widget.userType.name,
    };

    if (widget.userType == UserType.doctor) {
      payload['hospital'] = hospitalController.text.trim();
      payload['doctorId'] = doctorIdController.text.trim();
      payload['password'] = passwordController.text;
    } else {
      payload['email'] = emailController.text.trim();
      payload['password'] = passwordController.text;
    }

    widget.onLoginSuccess(payload);
  }

  UserType get userType => widget.userType;

  String getTitle(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    switch (userType) {
      case UserType.doctor:
        return l10n.doctorLogin;
      case UserType.researcher:
        return l10n.researcherLogin;
      case UserType.personal:
        return l10n.personalLogin;
    }
  }

  String getSubtitle(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    switch (userType) {
      case UserType.doctor:
        return l10n.doctorLoginSubtitle;
      case UserType.researcher:
        return l10n.researcherLoginSubtitle;
      case UserType.personal:
        return l10n.personalLoginSubtitle;
    }
  }

  Color get accentColor {
    switch (userType) {
      case UserType.doctor:
        return const Color(0xFF06B6D4);
      case UserType.researcher:
        return const Color(0xFF8B5CF6);
      case UserType.personal:
        return const Color(0xFF14B8A6);
    }
  }

  InputDecoration buildInputDecoration({
    required String label,
    required IconData icon,
    IconData? suffixIcon,
    VoidCallback? onSuffixTap,
  }) {
    return InputDecoration(
      labelText: label,
      prefixIcon: Icon(icon, color: accentColor),
      suffixIcon: suffixIcon != null
          ? GestureDetector(
              onTap: onSuffixTap,
              child: Icon(suffixIcon, color: Colors.grey),
            )
          : null,
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
        borderSide: BorderSide(color: accentColor, width: 2),
      ),
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              const Color(0xFF0F172A),
              const Color(0xFF1F2937),
            ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Container(
                constraints: const BoxConstraints(maxWidth: 440),
                padding: const EdgeInsets.all(32),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      blurRadius: 24,
                      color: Colors.black.withOpacity(0.15),
                      offset: const Offset(0, 12),
                    )
                  ],
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Header
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: accentColor.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(
                              userType == UserType.doctor
                                  ? Icons.medical_services_rounded
                                  : userType == UserType.researcher
                                      ? Icons.science_rounded
                                      : Icons.person_rounded,
                              color: accentColor,
                              size: 28,
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  getTitle(context),
                                  style: const TextStyle(
                                    fontSize: 24,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF111827),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  getSubtitle(context),
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: Colors.grey[600],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 32),

                      // Form Fields
                      if (userType == UserType.doctor) ...[
                        TextFormField(
                          controller: hospitalController,
                          decoration: buildInputDecoration(
                            label: AppLocalizations.of(context).hospitalId,
                            icon: Icons.local_hospital_rounded,
                          ),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return AppLocalizations.of(context)
                                  .hospitalIdRequired;
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: doctorIdController,
                          decoration: buildInputDecoration(
                            label: AppLocalizations.of(context).doctorId,
                            icon: Icons.badge_rounded,
                          ),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return AppLocalizations.of(context)
                                  .doctorIdRequired;
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: passwordController,
                          obscureText: !_showPassword,
                          decoration: buildInputDecoration(
                            label: AppLocalizations.of(context).password,
                            icon: Icons.lock_rounded,
                            suffixIcon: _showPassword
                                ? Icons.visibility_off_rounded
                                : Icons.visibility_rounded,
                            onSuffixTap: () {
                              setState(() {
                                _showPassword = !_showPassword;
                              });
                            },
                          ),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return AppLocalizations.of(context)
                                  .passwordRequired;
                            }
                            return null;
                          },
                        ),
                      ],
                      if (userType == UserType.researcher ||
                          userType == UserType.personal) ...[
                        TextFormField(
                          controller: emailController,
                          keyboardType: TextInputType.emailAddress,
                          decoration: buildInputDecoration(
                            label: AppLocalizations.of(context).email,
                            icon: Icons.email_rounded,
                          ),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return AppLocalizations.of(context).emailRequired;
                            }
                            if (!value.contains('@')) {
                              return AppLocalizations.of(context).invalidEmail;
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: passwordController,
                          obscureText: !_showPassword,
                          decoration: buildInputDecoration(
                            label: AppLocalizations.of(context).password,
                            icon: Icons.lock_rounded,
                            suffixIcon: _showPassword
                                ? Icons.visibility_off_rounded
                                : Icons.visibility_rounded,
                            onSuffixTap: () {
                              setState(() {
                                _showPassword = !_showPassword;
                              });
                            },
                          ),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return AppLocalizations.of(context)
                                  .passwordRequired;
                            }
                            return null;
                          },
                        ),
                      ],

                      const SizedBox(height: 28),

                      // Login Button
                      ElevatedButton(
                        onPressed: handleSubmit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: accentColor,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          elevation: 0,
                        ),
                        child: Text(
                          AppLocalizations.of(context).signIn,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),

                      const SizedBox(height: 16),

                      // Divider
                      Row(
                        children: [
                          Expanded(
                            child: Divider(
                              color: Colors.grey[300],
                              thickness: 1,
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            child: Text(
                              AppLocalizations.of(context).or,
                              style: TextStyle(
                                color: Colors.grey[600],
                                fontSize: 13,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Divider(
                              color: Colors.grey[300],
                              thickness: 1,
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 16),

                      // Guest Button
                      OutlinedButton(
                        onPressed: widget.onGuestAccess,
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(color: accentColor.withOpacity(0.3)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: Text(
                          AppLocalizations.of(context).continueAsGuest,
                          style: TextStyle(
                            color: accentColor,
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                          ),
                        ),
                      ),

                      const SizedBox(height: 20),

                      // Back Button
                      TextButton(
                        onPressed: widget.onBack,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.arrow_back_ios_rounded, size: 14),
                            const SizedBox(width: 6),
                            Text(
                              AppLocalizations.of(context).backToRoles,
                              style: TextStyle(
                                color: Colors.grey[600],
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
          ),
        ),
      ),
    );
  }
}