import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import CustomButton from '../components/CustomButton';
import CustomInput from '../components/CustomInput';
import { useAuth } from '../context/AuthContext';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/theme';

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

type ForgotPasswordScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
};

const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');
  const { resetPassword } = useAuth();

  const validate = (): boolean => {
    if (!email.trim()) {
      setError('Vui lòng nhập email');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Email không hợp lệ');
      return false;
    }
    setError('');
    return true;
  };

  const handleResetPassword = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await resetPassword(email.trim());
      setEmailSent(true);
    } catch (error: any) {
      let message = 'Gửi email thất bại. Vui lòng thử lại.';
      if (error.code === 'auth/user-not-found') {
        message = 'Không tìm thấy tài khoản với email này.';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Quá nhiều lần thử. Vui lòng thử lại sau.';
      }
      Alert.alert('Lỗi', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[colors.gradientStart, '#4834D4']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quên mật khẩu? 🔐</Text>
          <Text style={styles.subtitle}>Đừng lo, chúng tôi sẽ giúp bạn</Text>
        </View>
        <View style={[styles.circle, styles.circle1]} />
        <View style={[styles.circle, styles.circle2]} />
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formCard}>
            {emailSent ? (
              // Success state
              <View style={styles.successContainer}>
                <View style={styles.successIconWrapper}>
                  <LinearGradient
                    colors={[colors.success, '#1DB954']}
                    style={styles.successIconGradient}
                  >
                    <Ionicons name="checkmark" size={40} color={colors.white} />
                  </LinearGradient>
                </View>
                <Text style={styles.successTitle}>Email đã được gửi! ✉️</Text>
                <Text style={styles.successMessage}>
                  Chúng tôi đã gửi link đặt lại mật khẩu đến{'\n'}
                  <Text style={styles.emailHighlight}>{email}</Text>
                </Text>
                <Text style={styles.successHint}>
                  Kiểm tra hộp thư (bao gồm cả thư rác) và làm theo hướng dẫn.
                </Text>

                <CustomButton
                  title="Quay lại Đăng nhập"
                  onPress={() => navigation.navigate('Login')}
                  style={{ marginTop: spacing.lg }}
                />

                <TouchableOpacity
                  onPress={() => {
                    setEmailSent(false);
                    setEmail('');
                  }}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryText}>Gửi lại với email khác</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Form state
              <>
                <View style={styles.iconContainer}>
                  <LinearGradient
                    colors={[colors.gradientStart, colors.gradientEnd]}
                    style={styles.iconGradient}
                  >
                    <Ionicons name="key-outline" size={32} color={colors.white} />
                  </LinearGradient>
                </View>

                <Text style={styles.formTitle}>Đặt lại mật khẩu</Text>
                <Text style={styles.formSubtitle}>
                  Nhập email đã đăng ký, chúng tôi sẽ gửi link để đặt lại mật khẩu.
                </Text>

                <CustomInput
                  label="Email"
                  placeholder="Nhập địa chỉ email"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (error) setError('');
                  }}
                  keyboardType="email-address"
                  icon="mail-outline"
                  error={error}
                />

                <CustomButton
                  title="Gửi link đặt lại"
                  onPress={handleResetPassword}
                  loading={loading}
                  style={{ marginTop: spacing.md }}
                />

                <TouchableOpacity
                  onPress={() => navigation.navigate('Login')}
                  style={styles.backToLogin}
                >
                  <Ionicons name="arrow-back" size={16} color={colors.primary} />
                  <Text style={styles.backToLoginText}> Quay lại đăng nhập</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 50,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  headerContent: {
    zIndex: 1,
  },
  backButton: {
    marginBottom: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    color: colors.white,
    fontSize: 22,
    fontWeight: typography.fontWeights.bold,
  },
  headerTitle: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.extraBold,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSizes.lg,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: typography.fontWeights.regular,
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  circle1: {
    width: 160,
    height: 160,
    top: -30,
    right: -30,
  },
  circle2: {
    width: 90,
    height: 90,
    bottom: 10,
    left: -20,
  },
  keyboardView: {
    flex: 1,
    marginTop: -30,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  formCard: {
    backgroundColor: colors.cardBg,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.dark,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  backToLogin: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backToLoginText: {
    color: colors.primary,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semiBold,
  },
  // Success state
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  successIconWrapper: {
    marginBottom: spacing.lg,
  },
  successIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.dark,
    marginBottom: spacing.md,
  },
  successMessage: {
    fontSize: typography.fontSizes.md,
    color: colors.darkGray,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  emailHighlight: {
    color: colors.primary,
    fontWeight: typography.fontWeights.bold,
  },
  successHint: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  retryText: {
    color: colors.gray,
    fontSize: typography.fontSizes.sm,
    textDecorationLine: 'underline',
  },
});

export default ForgotPasswordScreen;
