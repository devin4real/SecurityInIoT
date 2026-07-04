import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
  Dimensions,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import CustomButton from '../components/CustomButton';
import LineChart from '../components/LineChart';
import { useAuth } from '../context/AuthContext';
// Gọi API qua Backend thay vì Firebase trực tiếp (Bảo mật)
import { getEnergyData, sendCommand, savePushToken, getDeviceStatus } from '../services/apiService';
import { registerForPushNotificationsAsync } from '../services/notificationService';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/theme';

const { width } = Dimensions.get('window');
const DEVICE_ID = 'esp32_01'; // ID thiết bị ESP32

interface AlarmData {
  id: string;
  alert: string;
  power: number;
  time: string;
  acknowledged: boolean;
}

const HomeScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Energy data
  const [energyData, setEnergyData] = useState<number[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Device control
  const [deviceOn, setDeviceOn] = useState(true);
  const [deviceStatus, setDeviceStatus] = useState('normal');
  const [sendingCommand, setSendingCommand] = useState(false);

  // Setup Push Notifications
  useEffect(() => {
    async function setupNotifications() {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          await savePushToken(token);
          console.log('✅ Đã lưu Push Token lên Backend thành công');
        }
      } catch (err) {
        console.error('❌ Lỗi khi thiết lập Push Notifications:', err);
      }
    }
    setupNotifications();
  }, []);

  // Lấy dữ liệu từ Backend API
  const fetchDeviceData = useCallback(async () => {
    try {
      const [energyRes, statusRes] = await Promise.all([
        getEnergyData(DEVICE_ID).catch(() => ({ success: false })),
        getDeviceStatus(DEVICE_ID).catch(() => ({ success: false }))
      ]);

      if (energyRes.success && energyRes.data) {
        const values = energyRes.data
          .filter((item: any) => item && typeof item.energy === 'number')
          .map((item: any) => item.energy);
        setEnergyData(values);
        setDataError(null);
      } else {
        setEnergyData([]);
        setDataError('Chưa có dữ liệu energy');
      }

      if (statusRes.success && statusRes.status) {
        setDeviceStatus(statusRes.status.state);
        setDeviceOn(statusRes.status.isOn);
      }
    } catch (error: any) {
      console.error('API Error:', error);
      setDataError(error.message || 'Lỗi kết nối Backend');
    } finally {
      setDataLoading(false);
    }
  }, []);

  // Lấy danh sách cảnh báo
  useEffect(() => {
    fetchDeviceData();
  }, [fetchDeviceData]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDeviceData();
    setRefreshing(false);
  }, [fetchDeviceData]);

  // Gửi lệnh bật/tắt qua Backend API → Backend publish MQTT → ESP32
  const handleToggleDevice = async () => {
    const newState = deviceOn ? 'off' : 'on';
    const actionText = deviceOn ? 'Tắt' : 'Bật';

    Alert.alert(
      `${actionText} thiết bị`,
      `Bạn có chắc muốn ${actionText.toLowerCase()} thiết bị?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: actionText,
          onPress: async () => {
            setSendingCommand(true);
            try {
              const response = await sendCommand(DEVICE_ID, newState as 'on' | 'off');
              if (response.success) {
                setDeviceOn(!deviceOn);
                setDeviceStatus('normal');
                Alert.alert('Thành công', response.message);
              }
            } catch (error: any) {
              Alert.alert('Lỗi', error.message || 'Gửi lệnh thất bại');
            } finally {
              setSendingCommand(false);
            }
          },
        },
      ]
    );
  };



  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
          } catch (error) {
            Alert.alert('Lỗi', 'Đăng xuất thất bại. Vui lòng thử lại.');
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={[styles.circle, styles.circle1]} />
        <View style={[styles.circle, styles.circle2]} />
        <View style={[styles.circle, styles.circle3]} />

        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Xin chào! 👋</Text>
              <Text style={styles.welcomeText}>Dashboard</Text>
            </View>
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {user?.email ? getInitials(user.email) : '?'}
                </Text>
              </LinearGradient>
            </View>
          </View>

          <View style={styles.emailBadge}>
            <Ionicons name="mail-outline" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.emailText}>{user?.email || 'N/A'}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >

        {/* Device Control Card */}
        <View style={styles.controlCard}>
          <View style={styles.controlCardHeader}>
            <View style={styles.controlCardInfo}>
              <View style={[styles.statusDot, { backgroundColor: deviceOn ? colors.success : colors.gray }]} />
              <Text style={styles.controlCardTitle}>Ổ cắm thông minh</Text>
            </View>
            <Text style={styles.controlCardDeviceId}>{DEVICE_ID}</Text>
          </View>
          <View style={styles.controlCardBody}>
            <Text style={[styles.controlCardStatus, deviceStatus === 'broken' && { color: colors.error, fontWeight: 'bold' }]}>
              Trạng thái: {deviceStatus === 'broken' ? '🔴 Bị hỏng' : (deviceOn ? '🟢 Đang bật' : '⚫️ Đã tắt')}
            </Text>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                { backgroundColor: deviceOn ? colors.error + '15' : colors.success + '15' },
              ]}
              onPress={handleToggleDevice}
              disabled={sendingCommand}
            >
              <Ionicons
                name={deviceOn ? 'power' : 'power'}
                size={28}
                color={deviceOn ? colors.error : colors.success}
              />
              <Text
                style={[
                  styles.toggleButtonText,
                  { color: deviceOn ? colors.error : colors.success },
                ]}
              >
                {sendingCommand ? 'Đang gửi...' : deviceOn ? 'Tắt' : 'Bật'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Energy Bar Chart */}
        <View style={{ marginBottom: spacing.lg }}>
          {dataLoading ? (
            <View style={styles.chartLoading}>
              <Ionicons name="bar-chart-outline" size={32} color={colors.gray} />
              <Text style={styles.chartLoadingText}>Đang tải dữ liệu...</Text>
            </View>
          ) : dataError ? (
            <View style={styles.chartLoading}>
              <Ionicons name="warning-outline" size={32} color={colors.error} />
              <Text style={[styles.chartLoadingText, { color: colors.error }]}>
                {dataError}
              </Text>
            </View>
          ) : (
            <LineChart
              data={energyData}
              title="Biểu đồ năng lượng"
              unit="kWh"
            />
          )}
        </View>



        {/* Account Info */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Thông tin tài khoản</Text>
        {[
          {
            icon: 'shield-checkmark-outline' as const,
            title: 'Xác thực',
            value: 'Firebase Auth + JWT',
            gradient: ['#2ED573', '#1DB954'] as const,
          },
          {
            icon: 'lock-closed-outline' as const,
            title: 'Mã hóa',
            value: 'TLS/SSL (MQTTS)',
            gradient: ['#667EEA', '#764BA2'] as const,
          },
          {
            icon: 'finger-print-outline' as const,
            title: 'UID',
            value: user?.uid?.substring(0, 16) + '...' || 'N/A',
            gradient: ['#FF6B6B', '#FF8E8E'] as const,
          },
        ].map((card, index) => (
          <View key={index} style={styles.statCard}>
            <LinearGradient
              colors={[...card.gradient]}
              style={styles.statIconWrapper}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name={card.icon} size={22} color={colors.white} />
            </LinearGradient>
            <View style={styles.statContent}>
              <Text style={styles.statTitle}>{card.title}</Text>
              <Text style={styles.statValue} numberOfLines={1}>
                {card.value}
              </Text>
            </View>
          </View>
        ))}

        {/* Logout */}
        <CustomButton
          title="Đăng Xuất"
          onPress={handleLogout}
          variant="outline"
          loading={loggingOut}
          style={{ marginTop: spacing.xl, marginBottom: spacing.xxl }}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  headerContent: {
    zIndex: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  greeting: {
    fontSize: typography.fontSizes.md,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 4,
  },
  welcomeText: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.extraBold,
    color: colors.white,
  },
  avatarContainer: {
    ...shadows.md,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  avatarText: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.white,
  },
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  emailText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: typography.fontSizes.sm,
    marginLeft: spacing.sm,
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  circle1: {
    width: 200,
    height: 200,
    top: -60,
    right: -60,
  },
  circle2: {
    width: 140,
    height: 140,
    bottom: -40,
    left: -30,
  },
  circle3: {
    width: 80,
    height: 80,
    top: 40,
    right: 100,
  },
  content: {
    flex: 1,
    marginTop: -15,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  // Alarm Banner
  alarmBanner: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  alarmBannerGradient: {
    padding: spacing.md,
  },
  alarmBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  alarmBannerText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  alarmBannerTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.white,
  },
  alarmBannerDesc: {
    fontSize: typography.fontSizes.xs,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  alarmAckButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-end',
  },
  alarmAckButtonText: {
    color: colors.white,
    fontWeight: typography.fontWeights.bold,
    fontSize: typography.fontSizes.sm,
  },
  // Device Control
  controlCard: {
    backgroundColor: colors.cardBg,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  controlCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  controlCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  controlCardTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.dark,
  },
  controlCardDeviceId: {
    fontSize: typography.fontSizes.xs,
    color: colors.gray,
    backgroundColor: colors.offWhite,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  controlCardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlCardStatus: {
    fontSize: typography.fontSizes.sm,
    color: colors.darkGray,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  toggleButtonText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
  },
  // Chart
  chartLoading: {
    backgroundColor: colors.cardBg,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  chartLoadingText: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray,
    marginTop: spacing.sm,
  },
  // Section
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.dark,
    marginBottom: spacing.md,
  },
  // Alarm History
  alarmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  alarmIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  alarmContent: {
    flex: 1,
  },
  alarmTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.dark,
  },
  alarmMeta: {
    fontSize: typography.fontSizes.xs,
    color: colors.gray,
    marginTop: 2,
  },
  alarmStatus: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semiBold,
  },
  // Stats
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  statIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  statContent: {
    flex: 1,
  },
  statTitle: {
    fontSize: typography.fontSizes.xs,
    color: colors.gray,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.dark,
  },
});

export default HomeScreen;
