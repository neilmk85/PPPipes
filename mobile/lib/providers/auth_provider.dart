import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/widget_service.dart';

enum LoginErrorField { email, password, general }

class AuthState {
  final AuthResponse? user;
  final bool isLoading;
  final bool isRestoring;
  final String? error;
  final LoginErrorField errorField;

  const AuthState({
    this.user,
    this.isLoading = false,
    this.isRestoring = true,
    this.error,
    this.errorField = LoginErrorField.general,
  });

  bool get isAuthenticated => user != null;

  AuthState copyWith({
    AuthResponse? user,
    bool? isLoading,
    bool? isRestoring,
    String? error,
    LoginErrorField? errorField,
    bool clearUser = false,
  }) =>
      AuthState(
        user: clearUser ? null : (user ?? this.user),
        isLoading: isLoading ?? this.isLoading,
        isRestoring: isRestoring ?? this.isRestoring,
        error: error,
        errorField: errorField ?? this.errorField,
      );
}

class AuthNotifier extends StateNotifier<AuthState> {
  final ApiService _api;
  final FlutterSecureStorage _storage;

  AuthNotifier(this._api, this._storage) : super(const AuthState()) {
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    final token = await _storage.read(key: 'accessToken');
    if (token == null) {
      state = state.copyWith(isRestoring: false);
      return;
    }
    try {
      final user = await _api.getMe();
      state = AuthState(user: user, isRestoring: false);
      _refreshWidget(user.outletId);
    } catch (_) {
      // Token invalid or expired — clear storage and go to login
      await _storage.deleteAll();
      state = state.copyWith(isRestoring: false, clearUser: true);
    }
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final auth = await _api.login(email, password);
      state = AuthState(user: auth, isRestoring: false);
      _refreshWidget(auth.outletId);
      return true;
    } on LoginException catch (e) {
      final msg = e.message;
      LoginErrorField field = LoginErrorField.general;
      String displayMsg = msg;

      if (msg.toLowerCase().contains('user not found')) {
        field = LoginErrorField.email;
        displayMsg = 'No account found with this email address.';
      } else if (msg.toLowerCase().contains('invalid credentials')) {
        field = LoginErrorField.password;
        displayMsg = 'Incorrect password. Please try again.';
      } else if (msg.toLowerCase().contains('inactive') ||
                 msg.toLowerCase().contains('not active')) {
        field = LoginErrorField.email;
        displayMsg = 'This account has been deactivated. Contact your admin.';
      }

      state = state.copyWith(
        isLoading: false,
        error: displayMsg,
        errorField: field,
      );
      return false;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Something went wrong. Please try again.',
        errorField: LoginErrorField.general,
      );
      return false;
    }
  }

  void _refreshWidget(int? outletId) {
    if (outletId == null) return;
    WidgetService(_api).refresh(outletId: outletId);
  }

  Future<void> logout() async {
    await _api.logout();
    state = const AuthState(isRestoring: false);
  }

  Future<void> toggleOutOfOffice(bool value) async {
    final actual = await _api.toggleOutOfOffice(value);
    final updated = state.user?.copyWith(outOfOffice: actual);
    if (updated != null) state = state.copyWith(user: updated);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ApiService(), const FlutterSecureStorage());
});
