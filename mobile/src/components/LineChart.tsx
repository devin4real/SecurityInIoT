import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/theme';

const { width: screenWidth } = Dimensions.get('window');

interface LineChartProps {
  data: number[];
  title?: string;
  unit?: string;
  lineColor?: string;
  dotColor?: readonly [string, string]; // gradient colors for dots
  maxPointsVisible?: number;
}

const LineChart: React.FC<LineChartProps> = ({
  data,
  title = 'Biểu đồ năng lượng',
  unit = 'kWh',
  lineColor = '#667EEA',
  dotColor = ['#667EEA', '#764BA2'] as const,
  maxPointsVisible = 10,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Không có dữ liệu</Text>
      </View>
    );
  }

  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const avgValue = data.reduce((a, b) => a + b, 0) / data.length;
  const chartHeight = 180;
  const chartPadding = spacing.lg;

  // Smart decimal formatting
  const formatVal = (v: number) =>
    v < 10 ? v.toFixed(3) : v < 100 ? v.toFixed(1) : Math.round(v).toString();

  // Thêm padding cho Y-axis để đường không chạm đáy/đỉnh
  const range = maxValue - minValue;
  const yPadding = range === 0 ? maxValue * 0.1 || 1 : range * 0.15;
  const yMin = Math.max(0, minValue - yPadding);
  const yMax = maxValue + yPadding;
  const yRange = yMax - yMin;

  // Y-axis labels (5 mốc)
  const yAxisSteps = 4;
  const decimalPlaces = yMax < 10 ? 3 : yMax < 100 ? 1 : 0;
  const yAxisLabels = Array.from({ length: yAxisSteps + 1 }, (_, i) =>
    (yMax - (yRange / yAxisSteps) * i).toFixed(decimalPlaces)
  );

  // Tính tọa độ cho mỗi điểm
  const availableWidth = screenWidth - chartPadding * 2 - 50; // 50 cho Y-axis
  const pointSpacing = Math.min(
    availableWidth / Math.max(maxPointsVisible - 1, 1),
    60
  );
  const totalContentWidth = Math.max((data.length - 1) * pointSpacing + 20, availableWidth);
  const needsScroll = data.length > maxPointsVisible;

  const getX = (index: number) => index * pointSpacing + 10;
  const getY = (value: number) => {
    if (yRange === 0) return chartHeight / 2;
    return chartHeight - ((value - yMin) / yRange) * chartHeight;
  };

  // Tạo các đoạn line nối các điểm
  const lineSegments = [];
  for (let i = 0; i < data.length - 1; i++) {
    const x1 = getX(i);
    const y1 = getY(data[i]);
    const x2 = getX(i + 1);
    const y2 = getY(data[i + 1]);

    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    lineSegments.push({
      key: i,
      left: x1,
      top: y1,
      width: length,
      angle,
    });
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Title */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{data.length} mẫu</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Cao nhất</Text>
          <Text style={[styles.statValue, { color: '#FF6B6B' }]}>
            {formatVal(maxValue)} {unit}
          </Text>
        </View>
        <View style={[styles.statItem, styles.statItemCenter]}>
          <Text style={styles.statLabel}>Trung bình</Text>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {formatVal(avgValue)} {unit}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Thấp nhất</Text>
          <Text style={[styles.statValue, { color: '#2ED573' }]}>
            {formatVal(minValue)} {unit}
          </Text>
        </View>
      </View>

      {/* Chart area */}
      <View style={styles.chartWrapper}>
        {/* Y-axis labels */}
        <View style={styles.yAxis}>
          {yAxisLabels.map((label, index) => (
            <Text key={index} style={styles.yAxisLabel}>
              {label}
            </Text>
          ))}
        </View>

        {/* Chart body */}
        <View style={styles.chartBody}>
          {/* Grid lines */}
          {yAxisLabels.map((_, index) => (
            <View
              key={index}
              style={[
                styles.gridLine,
                { top: (chartHeight / yAxisSteps) * index },
              ]}
            />
          ))}

          {/* Average line */}
          <View
            style={[
              styles.avgLine,
              {
                bottom: yRange > 0 ? ((avgValue - yMin) / yRange) * chartHeight : chartHeight / 2,
              },
            ]}
          >
            <Text style={styles.avgLineLabel}>TB</Text>
          </View>

          {/* Line chart content */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={needsScroll}
            scrollEnabled={needsScroll}
            contentContainerStyle={{ width: totalContentWidth, height: chartHeight }}
          >
            {/* Line segments */}
            {lineSegments.map((seg) => (
              <View
                key={seg.key}
                style={{
                  position: 'absolute',
                  left: seg.left,
                  top: seg.top,
                  width: seg.width,
                  height: 2.5,
                  backgroundColor: lineColor,
                  transformOrigin: 'left center',
                  transform: [{ rotate: `${seg.angle}deg` }],
                  borderRadius: 1,
                  opacity: 0.8,
                }}
              />
            ))}

            {/* Area fill (simplified using vertical lines for each point) */}
            {data.map((value, index) => {
              const x = getX(index);
              const y = getY(value);
              const fillHeight = chartHeight - y;
              return (
                <View
                  key={`fill-${index}`}
                  style={{
                    position: 'absolute',
                    left: x - 1,
                    top: y,
                    width: 2,
                    height: fillHeight,
                    backgroundColor: lineColor,
                    opacity: 0.05,
                  }}
                />
              );
            })}

            {/* Data points (dots) */}
            {data.map((value, index) => {
              const x = getX(index);
              const y = getY(value);
              return (
                <View key={`dot-${index}`}>
                  {/* Value label above dot */}
                  <Text
                    style={[
                      styles.dotValueLabel,
                      {
                        position: 'absolute',
                        left: x - 20,
                        top: y - 18,
                        width: 40,
                      },
                    ]}
                  >
                    {formatVal(value)}
                  </Text>

                  {/* Outer glow */}
                  <View
                    style={{
                      position: 'absolute',
                      left: x - 7,
                      top: y - 7,
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: lineColor + '20',
                    }}
                  />

                  {/* Inner dot */}
                  <View
                    style={{
                      position: 'absolute',
                      left: x - 4.5,
                      top: y - 4.5,
                      width: 9,
                      height: 9,
                      borderRadius: 4.5,
                      overflow: 'hidden',
                    }}
                  >
                    <LinearGradient
                      colors={[...dotColor]}
                      style={{ flex: 1 }}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />
                  </View>

                  {/* X-axis label */}
                  <Text
                    style={[
                      styles.xAxisLabel,
                      {
                        position: 'absolute',
                        left: x - 8,
                        top: chartHeight + 4,
                        width: 16,
                      },
                    ]}
                  >
                    {index + 1}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Unit label */}
      <Text style={styles.unitLabel}>Đơn vị: {unit} · Chỉ số: thứ tự mẫu</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBg,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.dark,
  },
  badge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.primary,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    backgroundColor: colors.offWhite,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statItemCenter: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.lightGray,
  },
  statLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.gray,
    marginBottom: 2,
  },
  statValue: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
  },
  chartWrapper: {
    flexDirection: 'row',
  },
  yAxis: {
    width: 42,
    height: 180,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: spacing.xs,
  },
  yAxisLabel: {
    fontSize: 9,
    color: colors.gray,
    fontWeight: typography.fontWeights.medium,
  },
  chartBody: {
    flex: 1,
    height: 200, // 180 chart + 20 for x-axis labels
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.lightGray,
  },
  avgLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.primary,
    borderStyle: 'dashed',
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avgLineLabel: {
    fontSize: 9,
    color: colors.primary,
    fontWeight: typography.fontWeights.bold,
    backgroundColor: colors.cardBg,
    paddingHorizontal: 3,
    position: 'absolute',
    right: 0,
    top: -8,
  },
  dotValueLabel: {
    fontSize: 8,
    color: colors.gray,
    fontWeight: typography.fontWeights.semiBold,
    textAlign: 'center',
  },
  xAxisLabel: {
    fontSize: 9,
    color: colors.gray,
    fontWeight: typography.fontWeights.medium,
    textAlign: 'center',
  },
  unitLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.gray,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  emptyContainer: {
    backgroundColor: colors.cardBg,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  emptyText: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray,
  },
});

export default LineChart;
