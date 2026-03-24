import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'login_page.dart';
import 'analysis_page.dart';
import '../l10n/app_localizations.dart';
import '../providers/locale_provider.dart';

class LandingPage extends StatefulWidget {
  const LandingPage({super.key});

  @override
  State<LandingPage> createState() => _LandingPageState();
}

class _LandingPageState extends State<LandingPage> with TickerProviderStateMixin {
  late List<AnimationController> _cardControllers;

  @override
  void initState() {
    super.initState();
    _cardControllers = List.generate(
      3,
      (index) => AnimationController(
        duration: const Duration(milliseconds: 600),
        vsync: this,
      ),
    );
    Future.delayed(const Duration(milliseconds: 100), () {
      for (int i = 0; i < _cardControllers.length; i++) {
        Future.delayed(Duration(milliseconds: i * 150), () {
          if (mounted) _cardControllers[i].forward();
        });
      }
    });
  }

  @override
  void dispose() {
    for (var controller in _cardControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  void _goToAnalysis(BuildContext context, String userType) {
    UserType type;
    if (userType == 'doctor') {
      type = UserType.doctor;
    } else if (userType == 'researcher') {
      type = UserType.researcher;
    } else {
      type = UserType.personal;
    }

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => LoginPage(
          userType: type,
          onLoginSuccess: (loginData) {
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute(
                builder: (_) => AnalysisPage(userType: userType),
              ),
              (route) => false,
            );
          },
          onBack: () {
            Navigator.pop(context);
          },
          onGuestAccess: () {
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute(
                builder: (_) => AnalysisPage(userType: userType),
              ),
              (route) => false,
            );
          },
        ),
      ),
    );
  }

  Widget _buildUserCard({
    required BuildContext context,
    required String title,
    required String description,
    required IconData icon,
    required String userType,
    required Color color,
    required AnimationController animationController,
  }) {
    return SlideTransition(
      position: Tween<Offset>(
        begin: const Offset(0, 0.3),
        end: Offset.zero,
      ).animate(CurvedAnimation(parent: animationController, curve: Curves.easeOut)),
      child: FadeTransition(
        opacity: animationController,
        child: StatefulBuilder(
          builder: (context, setState) {
            bool isHovered = false;

            return MouseRegion(
              onEnter: (_) => setState(() => isHovered = true),
              onExit: (_) => setState(() => isHovered = false),
              child: GestureDetector(
                onTap: () => _goToAnalysis(context, userType),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeInOut,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        color.withOpacity(isHovered ? 0.95 : 0.85),
                        color.withOpacity(isHovered ? 1.0 : 0.9),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: color.withOpacity(isHovered ? 0.5 : 0.25),
                        blurRadius: isHovered ? 28 : 16,
                        spreadRadius: isHovered ? 2 : 0,
                        offset: Offset(0, isHovered ? 12 : 8),
                      ),
                    ],
                    border: Border.all(
                      color: Colors.white.withOpacity(0.1),
                      width: 1,
                    ),
                  ),
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Icon(
                            icon,
                            size: 40,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 20),
                        Text(
                          title,
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          description,
                          style: TextStyle(
                            fontSize: 15,
                            color: Colors.white.withOpacity(0.95),
                            height: 1.6,
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                        const SizedBox(height: 16),
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(
                              isHovered ? 0.3 : 0.2,
                            ),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                AppLocalizations.of(context).getStarted,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 14,
                                ),
                              ),
                              AnimatedContainer(
                                duration: const Duration(milliseconds: 300),
                                margin: EdgeInsets.only(left: isHovered ? 12 : 8),
                                child: const Icon(
                                  Icons.arrow_forward,
                                  color: Colors.white,
                                  size: 18,
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
          },
        ),
      ),
    );
  }

  Widget _buildLanguageButton({
    required BuildContext context,
    required String label,
    required String languageCode,
    required bool isSelected,
  }) {
    return GestureDetector(
      onTap: () {
        Provider.of<LocaleProvider>(context, listen: false)
            .setLocaleByLanguageCode(languageCode);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFF14B8A6).withOpacity(0.3)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF14B8A6)
                : Colors.white.withOpacity(0.2),
            width: 1.5,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? const Color(0xFF14B8A6) : Colors.white,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
            fontSize: 14,
            letterSpacing: 0.3,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isMobile = screenWidth < 600;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              const Color(0xFF0F172A),
              const Color(0xFF1A2332),
            ],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            padding: EdgeInsets.symmetric(
              horizontal: isMobile ? 20 : 32,
              vertical: isMobile ? 32 : 48,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Language Selection Bar at Top
                Consumer<LocaleProvider>(
                  builder: (context, localeProvider, child) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 32),
                      child: Center(
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.08),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: Colors.white.withOpacity(0.15),
                              width: 1,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            spacing: 8,
                            children: [
                              _buildLanguageButton(
                                context: context,
                                label: AppLocalizations.of(context).english,
                                languageCode: 'en',
                                isSelected:
                                    localeProvider.locale.languageCode == 'en',
                              ),
                              _buildLanguageButton(
                                context: context,
                                label: AppLocalizations.of(context).turkish,
                                languageCode: 'tr',
                                isSelected:
                                    localeProvider.locale.languageCode == 'tr',
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
                // Enhanced Header Section
                Center(
                  child: Column(
                    children: [
                      // Animated Logo Container
                      FadeTransition(
                        opacity: _cardControllers[0],
                        child: Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.08),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: Colors.white.withOpacity(0.1),
                              width: 1.5,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF14B8A6).withOpacity(0.15),
                                blurRadius: 20,
                                spreadRadius: 2,
                              ),
                            ],
                          ),
                          child: const Icon(
                            Icons.health_and_safety_rounded,
                            size: 56,
                            color: Color(0xFF14B8A6),
                          ),
                        ),
                      ),
                      const SizedBox(height: 28),

                      // Main Title
                      FadeTransition(
                        opacity: _cardControllers[0],
                        child: ShaderMask(
                          shaderCallback: (bounds) => LinearGradient(
                            colors: [
                              Colors.white,
                              Colors.white.withOpacity(0.9),
                            ],
                          ).createShader(bounds),
                          child: const Text(
                            'SUDerm',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 56,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                              letterSpacing: 2,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Subtitle
                      FadeTransition(
                        opacity: _cardControllers[0],
                        child: Text(
                          AppLocalizations.of(context).subtitle,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 18,
                            color: const Color(0xFF14B8A6),
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                      const SizedBox(height: 28),

                      // Description Box
                      FadeTransition(
                        opacity: _cardControllers[0],
                        child: Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.06),
                            border: Border.all(
                              color: const Color(0xFF14B8A6).withOpacity(0.3),
                              width: 1,
                            ),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Text(
                            AppLocalizations.of(context).description,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 15,
                              color: Color(0xFFD1D5DB),
                              height: 1.8,
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 56),

                // Section Title
                FadeTransition(
                  opacity: _cardControllers[0],
                  child: Padding(
                    padding: const EdgeInsets.only(left: 4),
                    child: Text(
                      AppLocalizations.of(context).selectYourRole,
                      style: const TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // User Type Cards
                if (isMobile)
                  Column(
                    spacing: 20,
                    children: [
                      _buildUserCard(
                        context: context,
                        title: AppLocalizations.of(context).forDoctors,
                        description:
                            AppLocalizations.of(context).doctorDescription,
                        icon: Icons.medical_services_rounded,
                        userType: 'doctor',
                        color: const Color(0xFF06B6D4),
                        animationController: _cardControllers[0],
                      ),
                      _buildUserCard(
                        context: context,
                        title: AppLocalizations.of(context).forResearchers,
                        description:
                            AppLocalizations.of(context).researcherDescription,
                        icon: Icons.science_rounded,
                        userType: 'researcher',
                        color: const Color(0xFF8B5CF6),
                        animationController: _cardControllers[1],
                      ),
                      _buildUserCard(
                        context: context,
                        title: AppLocalizations.of(context).personalUse,
                        description:
                            AppLocalizations.of(context).personalDescription,
                        icon: Icons.person_rounded,
                        userType: 'personal',
                        color: const Color(0xFF14B8A6),
                        animationController: _cardControllers[2],
                      ),
                    ],
                  )
                else
                  GridView(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      childAspectRatio: 1 / 1.1,
                      mainAxisSpacing: 24,
                      crossAxisSpacing: 24,
                    ),
                    children: [
                      _buildUserCard(
                        context: context,
                        title: AppLocalizations.of(context).forDoctors,
                        description:
                            AppLocalizations.of(context).doctorDescription,
                        icon: Icons.medical_services_rounded,
                        userType: 'doctor',
                        color: const Color(0xFF06B6D4),
                        animationController: _cardControllers[0],
                      ),
                      _buildUserCard(
                        context: context,
                        title: AppLocalizations.of(context).forResearchers,
                        description:
                            AppLocalizations.of(context).researcherDescription,
                        icon: Icons.science_rounded,
                        userType: 'researcher',
                        color: const Color(0xFF8B5CF6),
                        animationController: _cardControllers[1],
                      ),
                      _buildUserCard(
                        context: context,
                        title: AppLocalizations.of(context).personalUse,
                        description:
                            AppLocalizations.of(context).personalDescription,
                        icon: Icons.person_rounded,
                        userType: 'personal',
                        color: const Color(0xFF14B8A6),
                        animationController: _cardControllers[2],
                      ),
                    ],
                  ),
                const SizedBox(height: 48),

                // Enhanced Footer
                Center(
                  child: Column(
                    children: [
                      Container(
                        height: 1,
                        width: 60,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Colors.white.withOpacity(0),
                              Colors.white.withOpacity(0.2),
                              Colors.white.withOpacity(0),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        '© 2024 Sabanci University',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.white.withOpacity(0.6),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Medical Research Lab',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.white.withOpacity(0.45),
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
}