import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getOverloadHistory } from '../services/apiService';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/theme';

interface OverloadEvent {
  id: string;
  alert: string;
  power: number;
  time: string;
  timestamp: number;
}

const AlertsScreen: React.FC = () => {
  const [history, setHistory] = useState<OverloadEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setError(null);
      const res = await getOverloadHistory(50);
      if (res.success && res.data) {
        setHistory(res.data);
      } else {
        setHistory([]);
      }
    } catch (err: any) {
      console.error('Error fetching overload history:', err);
      setError('Không thể tải dữ liệu lịch sử sự cố.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const formatTime = (timeStr: string, timestamp: number) => {
    if (timeStr) return timeStr;
    if (timestamp) {
      const d = new Date(timestamp);
      return d.toLocaleString('vi-VN');
    }
    return 'N/A';
  };

  const renderItem = ({ item }: { item: OverloadEvent }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name="warning" size={24} color={colors.error} />
        </View>
        <View style={styles.cardTitleContainer}>
          <Text style={styles.cardTitle}>Vượt công suất</Text>
          <Text style={styles.cardSubtitle}>{formatTime(item.time, item.timestamp)}</Text>
        </View>
      </View>
      
      <View style={styles.cardBody}>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Cảnh báo:</Text>
          <Text style={styles.dataValue}>{item.alert}</Text>
        </View>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Công suất:</Text>
          <Text style={[styles.dataValue, { color: colors.error, fontWeight: 'bold' }]}>
            {item.power} W
          </Text>
        </View>
      </View>
    </View>
  );

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
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Sự cố</Text>
          <Text style={styles.headerSubtitle}>Lịch sử quá tải thiết bị</Text>
        </View>
      </LinearGradient>

      {/* Content */}
      <View style={styles.content}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="cloud-offline-outline" size={48} color={colors.gray} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : history.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="checkmark-circle-outline" size={64} color={colors.success} />
            <Text style={styles.emptyText}>Tuyệt vời!</Text>
            <Text style={styles.emptySubText}>Chưa có sự cố quá tải nào xảy ra.</Text>
          </View>
        ) : (
          <FlatList
            data={history}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
          />
        )}
      </View>
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
    paddingBottom: 40,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  headerContent: {
    zIndex: 1,
  },
  headerTitle: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.extraBold,
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: typography.fontSizes.sm,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  circle1: {
    width: 150,
    height: 150,
    top: -40,
    right: -40,
  },
  circle2: {
    width: 100,
    height: 100,
    bottom: -20,
    left: -20,
  },
  content: {
    flex: 1,
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.offWhite,
  },
  listContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.gray,
    fontSize: typography.fontSizes.sm,
  },
  errorText: {
    marginTop: spacing.md,
    color: colors.error,
    fontSize: typography.fontSizes.md,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: spacing.md,
    color: colors.dark,
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
  },
  emptySubText: {
    marginTop: spacing.xs,
    color: colors.gray,
    fontSize: typography.fontSizes.md,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    paddingBottom: spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.error + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.dark,
  },
  cardSubtitle: {
    fontSize: typography.fontSizes.xs,
    color: colors.gray,
    marginTop: 2,
  },
  cardBody: {
    marginTop: spacing.xs,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  dataLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray,
  },
  dataValue: {
    fontSize: typography.fontSizes.sm,
    color: colors.dark,
    fontWeight: typography.fontWeights.medium,
  },
});

export default AlertsScreen;
