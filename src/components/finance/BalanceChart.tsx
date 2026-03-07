import { getContrastSafeColor } from "@/components/editor/Editor";
import { useTheme } from "@/providers/ThemeProvider";
import type { MonthlyBalance } from "@/services/financeService";
import { formatBRL } from "@/utils/currency";
import React, { useRef } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";

import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedSvgText = Animated.createAnimatedComponent(SvgText);

const BAR_WIDTH = 40;
const BAR_GAP = 16;
const CHART_HEIGHT = 180;
const CHART_PADDING_TOP = 30;
const CHART_PADDING_BOTTOM = 30;
const LABEL_HEIGHT = 20;

interface BalanceChartProps {
  data: MonthlyBalance[];
}

interface AnimatedBarProps {
  x: number;
  barY: number;
  barHeight: number;
  fill: string;
  zeroY: number;
  isPositive: boolean;
  valueText: string;
  isDark: boolean;
  month: string;
}

function AnimatedBar({
  x,
  barY,
  barHeight,
  fill,
  zeroY,
  isPositive,
  valueText,
  isDark,
  month,
}: AnimatedBarProps) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withSpring(1, {
      damping: 15,
      stiffness: 90,
    });
  }, []);

  const animatedRectProps = useAnimatedProps(() => {
    // Height grows from 0 to barHeight
    // Y position starts at zeroY and moves to barY (if positive) or stays at zeroY (if negative)
    const currentHeight = barHeight * progress.value;
    const currentY = isPositive ? zeroY - currentHeight : zeroY;

    return {
      height: currentHeight,
      y: currentY,
    };
  });

  const animatedTextProps = useAnimatedProps(() => {
    const currentHeight = barHeight * progress.value;
    const currentY = isPositive ? zeroY - currentHeight : zeroY;
    
    // Label follows the edge of the bar
    const labelY = isPositive
      ? currentY - 6
      : currentY + currentHeight + 14;

    return {
      y: labelY,
    };
  });

  return (
    <React.Fragment>
      {/* Bar */}
      <AnimatedRect
        x={x}
        width={BAR_WIDTH}
        rx={6}
        ry={6}
        fill={fill}
        opacity={0.85}
        animatedProps={animatedRectProps}
      />

      {/* Value label */}
      <AnimatedSvgText
        x={x + BAR_WIDTH / 2}
        fontSize={9}
        fontWeight="600"
        fill={isDark ? "#A1A1AA" : "#71717A"}
        textAnchor="middle"
        animatedProps={animatedTextProps}
      >
        {valueText}
      </AnimatedSvgText>

      {/* Month label */}
      <SvgText
        x={x + BAR_WIDTH / 2}
        y={CHART_HEIGHT - 6}
        fontSize={11}
        fontWeight="600"
        fill={isDark ? "#D4D4D8" : "#52525B"}
        textAnchor="middle"
      >
        {month}
      </SvgText>
    </React.Fragment>
  );
}

export function BalanceChart({ data }: BalanceChartProps) {
  const { primaryColor, resolvedTheme } = useTheme();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const isDark = resolvedTheme === "dark";
  const safeAccent = getContrastSafeColor(primaryColor, isDark);
  const scrollRef = useRef<ScrollView>(null);

  if (data.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? "#171717" : "#F5F5F5" }]}>
        <Text style={[styles.emptyText, { color: isDark ? "#71717A" : "#A1A1AA" }]}>
          Nenhum dado disponível
        </Text>
      </View>
    );
  }

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.balance)), 100);
  const drawableHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM - LABEL_HEIGHT;
  
  const totalBarsWidth = data.length * (BAR_WIDTH + BAR_GAP) - BAR_GAP;
  const containerInnerWidth = SCREEN_WIDTH - 64; // horizontal margins + paddings
  const minRequiredWidth = totalBarsWidth + 80; // 40px safe area on left and right for long texts
  const svgWidth = Math.max(minRequiredWidth, containerInnerWidth);

  let startX = 40;
  if (minRequiredWidth < containerInnerWidth) {
    startX = (containerInnerWidth - totalBarsWidth) / 2;
  }

  const positiveColor = "#22C55E"; // green
  const negativeColor = "#EF4444"; // red

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#171717" : "#F5F5F5" }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 4 }}
        onContentSizeChange={() => {
          // Scroll to end (most recent month)
          scrollRef.current?.scrollToEnd({ animated: false });
        }}
      >
        <Svg width={svgWidth} height={CHART_HEIGHT}>
          {/* Zero line */}
          <Rect
            x={0}
            y={CHART_PADDING_TOP + drawableHeight / 2}
            width={svgWidth}
            height={1}
            fill={isDark ? "#3F3F46" : "#D4D4D8"}
          />

          {data.map((item, index) => {
            const x = startX + index * (BAR_WIDTH + BAR_GAP);
            const isPositive = item.balance >= 0;
            const barHeight = Math.max(
              (Math.abs(item.balance) / maxAbs) * (drawableHeight / 2),
              4 // minimum visible bar
            );
            const zeroY = CHART_PADDING_TOP + drawableHeight / 2;
            const barY = isPositive ? zeroY - barHeight : zeroY;
            const fill = isPositive ? positiveColor : negativeColor;

            const valueText = item.balance === 0
              ? "R$ 0"
              : formatBRL(item.balance);

            return (
              <AnimatedBar
                key={item.fullMonth}
                x={x}
                barY={barY}
                barHeight={barHeight}
                fill={fill}
                zeroY={zeroY}
                isPositive={isPositive}
                valueText={valueText}
                isDark={isDark}
                month={item.month}
              />
            );
          })}
        </Svg>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 12,
    marginHorizontal: 20,
    overflow: "hidden",
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 40,
    fontSize: 14,
    fontWeight: "500",
  },
});
