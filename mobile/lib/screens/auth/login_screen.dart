import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscure = true;
  late final AnimationController _fadeCtrl;
  late final Animation<double> _fadeAnim;

  // Brand colours — web app palette
  static const _bgTop    = Color(0xFF1E3A8A); // primary-900
  static const _bgMid    = Color(0xFF1D4ED8); // primary-700
  static const _bgBot    = Color(0xFF312E81); // indigo-900
  static const _violet   = Color(0xFF7C3AED); // violet-600
  static const _blue     = Color(0xFF2563EB); // blue-600
  static const _accent   = Color(0xFF60A5FA); // blue-400

  @override
  void initState() {
    super.initState();
    _emailCtrl.text    = 'admin@pppipeproducts.com';
    _passwordCtrl.text = 'Admin@123';
    _fadeCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 900));
    _fadeAnim =
        CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
    _fadeCtrl.forward();
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _fadeCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final ok = await ref
        .read(authProvider.notifier)
        .login(_emailCtrl.text.trim(), _passwordCtrl.text);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
              ref.read(authProvider).error ?? 'Login failed'),
          backgroundColor: Colors.red.shade700,
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(authProvider).isLoading;
    final size = MediaQuery.of(context).size;

    return Scaffold(
      body: Stack(
        children: [
          // ── Full-screen gradient background ──
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [_bgTop, _bgMid, _bgBot],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: [0.0, 0.55, 1.0],
              ),
            ),
          ),

          // ── Decorative blobs ──
          _Blob(
            left: -60,
            top: size.height * 0.04,
            size: 220,
            color: _violet.withValues(alpha: 0.22),
          ),
          _Blob(
            right: -40,
            top: size.height * 0.18,
            size: 180,
            color: _blue.withValues(alpha: 0.25),
          ),
          _Blob(
            left: size.width * 0.3,
            bottom: size.height * 0.08,
            size: 240,
            color: _violet.withValues(alpha: 0.15),
          ),
          _Blob(
            right: -30,
            bottom: size.height * 0.22,
            size: 140,
            color: _accent.withValues(alpha: 0.12),
          ),

          // ── Subtle grid lines ──
          CustomPaint(
            size: size,
            painter: _GridPainter(),
          ),

          // ── Main content ──
          SafeArea(
            child: FadeTransition(
              opacity: _fadeAnim,
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                    horizontal: 28, vertical: 20),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                      minHeight: size.height -
                          MediaQuery.of(context).padding.top -
                          MediaQuery.of(context).padding.bottom),
                  child: IntrinsicHeight(
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Spacer(flex: 2),

                          // ── Logo + brand ──
                          Row(
                            children: [
                              Container(
                                width: 56,
                                height: 56,
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [_violet, _blue],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  borderRadius:
                                      BorderRadius.circular(16),
                                  boxShadow: [
                                    BoxShadow(
                                      color: _violet.withValues(
                                          alpha: 0.55),
                                      blurRadius: 20,
                                      offset: const Offset(0, 6),
                                    )
                                  ],
                                ),
                                child: const Icon(
                                  Icons.factory_rounded,
                                  color: Colors.white,
                                  size: 30,
                                ),
                              ),
                              const SizedBox(width: 14),
                              Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'P&P Pipe Products',
                                    style: TextStyle(
                                      fontSize: 20,
                                      fontWeight: FontWeight.w800,
                                      color: Colors.white,
                                      letterSpacing: 0.2,
                                    ),
                                  ),
                                  Text(
                                    'Production & Sales Management',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.white
                                          .withValues(alpha: 0.65),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),

                          const SizedBox(height: 40),

                          // ── Welcome heading ──
                          const Text(
                            'Welcome back',
                            style: TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Sign in to your account to continue',
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.white.withValues(alpha: 0.65),
                            ),
                          ),

                          const SizedBox(height: 36),

                          // ── Email ──
                          _GlassLabel('Email'),
                          const SizedBox(height: 8),
                          _GlassField(
                            controller: _emailCtrl,
                            hint: 'admin@pppipeproducts.com',
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            icon: Icons.email_outlined,
                            validator: (v) =>
                                v == null || !v.contains('@')
                                    ? 'Enter a valid email'
                                    : null,
                          ),

                          const SizedBox(height: 20),

                          // ── Password ──
                          _GlassLabel('Password'),
                          const SizedBox(height: 8),
                          _GlassField(
                            controller: _passwordCtrl,
                            hint: '••••••••',
                            obscureText: _obscure,
                            textInputAction: TextInputAction.done,
                            icon: Icons.lock_outline_rounded,
                            onFieldSubmitted: (_) =>
                                isLoading ? null : _submit(),
                            validator: (v) => v == null || v.isEmpty
                                ? 'Password required'
                                : null,
                            suffixIcon: GestureDetector(
                              onTap: () =>
                                  setState(() => _obscure = !_obscure),
                              child: Icon(
                                _obscure
                                    ? Icons.visibility_off_outlined
                                    : Icons.visibility_outlined,
                                size: 20,
                                color:
                                    Colors.white.withValues(alpha: 0.6),
                              ),
                            ),
                          ),

                          const SizedBox(height: 32),

                          // ── Sign In button ──
                          SizedBox(
                            width: double.infinity,
                            height: 52,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                gradient: isLoading
                                    ? null
                                    : const LinearGradient(
                                        colors: [_violet, _blue],
                                        begin: Alignment.centerLeft,
                                        end: Alignment.centerRight,
                                      ),
                                color: isLoading
                                    ? Colors.white
                                        .withValues(alpha: 0.15)
                                    : null,
                                borderRadius: BorderRadius.circular(14),
                                boxShadow: isLoading
                                    ? []
                                    : [
                                        BoxShadow(
                                          color: _violet
                                              .withValues(alpha: 0.5),
                                          blurRadius: 20,
                                          offset: const Offset(0, 8),
                                        ),
                                      ],
                              ),
                              child: ElevatedButton(
                                onPressed: isLoading ? null : _submit,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.transparent,
                                  shadowColor: Colors.transparent,
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(
                                    borderRadius:
                                        BorderRadius.circular(14),
                                  ),
                                ),
                                child: isLoading
                                    ? const SizedBox(
                                        width: 22,
                                        height: 22,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2.5,
                                          color: Colors.white,
                                        ),
                                      )
                                    : const Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: [
                                          Text(
                                            'Sign In',
                                            style: TextStyle(
                                              fontSize: 16,
                                              fontWeight: FontWeight.w700,
                                              letterSpacing: 0.3,
                                            ),
                                          ),
                                          SizedBox(width: 8),
                                          Icon(
                                            Icons.arrow_forward_rounded,
                                            size: 18,
                                          ),
                                        ],
                                      ),
                              ),
                            ),
                          ),

                          const SizedBox(height: 24),

                          // ── Hint ──
                          Center(
                            child: Text(
                              'Default: admin@pppipeproducts.com / Admin@123',
                              style: TextStyle(
                                fontSize: 11,
                                color:
                                    Colors.white.withValues(alpha: 0.4),
                              ),
                            ),
                          ),

                          const Spacer(flex: 3),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Reusable glass label ──────────────────────────────────
class _GlassLabel extends StatelessWidget {
  final String text;
  const _GlassLabel(this.text);

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: Colors.white,
          letterSpacing: 0.3,
        ),
      );
}

// ── Reusable glass input field ────────────────────────────
class _GlassField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final bool obscureText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final IconData icon;
  final Widget? suffixIcon;
  final String? Function(String?)? validator;
  final void Function(String)? onFieldSubmitted;

  const _GlassField({
    required this.controller,
    required this.hint,
    required this.icon,
    this.obscureText = false,
    this.keyboardType,
    this.textInputAction,
    this.suffixIcon,
    this.validator,
    this.onFieldSubmitted,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      onFieldSubmitted: onFieldSubmitted,
      validator: validator,
      style: const TextStyle(
        color: Colors.white,
        fontSize: 15,
      ),
      cursorColor: Colors.white,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(
          color: Colors.white.withValues(alpha: 0.35),
          fontSize: 14,
        ),
        prefixIcon: Icon(icon,
            color: Colors.white.withValues(alpha: 0.55), size: 20),
        suffixIcon: suffixIcon != null
            ? Padding(
                padding: const EdgeInsets.only(right: 14),
                child: suffixIcon,
              )
            : null,
        suffixIconConstraints: const BoxConstraints(),
        contentPadding: const EdgeInsets.symmetric(
            horizontal: 16, vertical: 16),
        filled: true,
        fillColor: Colors.white.withValues(alpha: 0.10),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(
            color: Colors.white.withValues(alpha: 0.20),
            width: 1.2,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(
            color: Colors.white,
            width: 1.8,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(
            color: Color(0xFFFCA5A5),
            width: 1.2,
          ),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(
            color: Color(0xFFFCA5A5),
            width: 1.8,
          ),
        ),
        errorStyle: const TextStyle(
          color: Color(0xFFFCA5A5),
          fontSize: 11,
        ),
      ),
    );
  }
}

// ── Decorative blob ───────────────────────────────────────
class _Blob extends StatelessWidget {
  final double? left;
  final double? right;
  final double? top;
  final double? bottom;
  final double size;
  final Color color;

  const _Blob({
    this.left,
    this.right,
    this.top,
    this.bottom,
    required this.size,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: left,
      right: right,
      top: top,
      bottom: bottom,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}

// ── Subtle grid line painter ──────────────────────────────
class _GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.04)
      ..strokeWidth = 1;

    const gap = 44.0;

    // Vertical lines
    for (double x = 0; x < size.width; x += gap) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    // Horizontal lines
    for (double y = 0; y < size.height; y += gap) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }

    // Diagonal accent lines (top-left corner)
    final diag = Paint()
      ..color = Colors.white.withValues(alpha: 0.05)
      ..strokeWidth = 1;
    for (int i = 0; i < 6; i++) {
      final offset = i * 60.0;
      canvas.drawLine(
        Offset(offset, 0),
        Offset(0, offset),
        diag,
      );
    }

    // Subtle radial glow (centre-top)
    final glowPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          const Color(0xFF7C3AED).withValues(alpha: 0.18),
          Colors.transparent,
        ],
      ).createShader(
        Rect.fromCircle(
          center: Offset(size.width / 2, 0),
          radius: size.width * 0.8,
        ),
      );
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), glowPaint);

    // Bottom-right accent circle
    final accentPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          const Color(0xFF2563EB).withValues(alpha: 0.22),
          Colors.transparent,
        ],
      ).createShader(
        Rect.fromCircle(
          center: Offset(size.width, size.height),
          radius: size.width * 0.7,
        ),
      );
    canvas.drawRect(
        Rect.fromLTWH(0, 0, size.width, size.height), accentPaint);

    // Dotted pattern (top-right area)
    final dotPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.07)
      ..style = PaintingStyle.fill;

    for (double dx = size.width - 120; dx < size.width + 20; dx += 18) {
      for (double dy = 80; dy < 220; dy += 18) {
        canvas.drawCircle(Offset(dx, dy), 2, dotPaint);
      }
    }

    // Arc decoration (bottom-left)
    final arcPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.06)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    for (int r = 1; r <= 3; r++) {
      canvas.drawArc(
        Rect.fromCircle(
          center: Offset(0, size.height),
          radius: r * 70.0,
        ),
        -math.pi / 2,
        math.pi / 2,
        false,
        arcPaint,
      );
    }
  }

  @override
  bool shouldRepaint(_GridPainter old) => false;
}
