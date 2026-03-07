import { TaskCard } from "@/components/task/TaskCard";
import { Button } from "@/components/ui/Button";
import type { Task } from "@/db/schema";
import { useTheme } from "@/providers/ThemeProvider";
import { completeTask, getTasksWithReminders, uncompleteTask } from "@/services/taskService";
import { useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft, CalendarOff } from "lucide-react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Helpers ─────────────────────────────────────
const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAYS_FULL_PT = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const WEEK_HEIGHT = 52;
const MONTH_HEIGHT = 280;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TOTAL_DAYS = 365;
const CENTER_INDEX = Math.floor(TOTAL_DAYS / 2);

function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - start.getTime() + (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60000;
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
}

function getStartOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff, 12, 0, 0, 0);
}

function getMonthGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = [];

  for (let i = 0; i < startDow; i++) currentWeek.push(null);

  for (let day = 1; day <= lastDay.getDate(); day++) {
    currentWeek.push(new Date(year, month, day, 12, 0, 0, 0));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return weeks;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Noon Normalization: set hours to 12 so timezone offsets (-12h to +12h) never shift the day */
function normalizeToNoon(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12, 0, 0, 0);
  return r;
}

// ─── Types ───────────────────────────────────────
type Colors = {
  text: string;
  textSecondary: string;
  surface: string;
  surfaceSecondary: string;
  border: string;
  cardBg: string;
  cardBorder: string;
};

// ─── Memoized Sub-Components ─────────────────────

/** A single day page — shows tasks sorted by time using the shared TaskCard */
const DayPage = React.memo(({
  date,
  tasks,
  colors,
  onTaskPress,
  onToggleComplete,
  bottomInset,
}: {
  date: Date;
  tasks: Task[];
  colors: Colors;
  onTaskPress: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  bottomInset: number;
}) => {
  // Sort tasks by time (tasks without time go last)
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (!a.deliveryTime && !b.deliveryTime) return 0;
      if (!a.deliveryTime) return 1;
      if (!b.deliveryTime) return -1;
      return a.deliveryTime.localeCompare(b.deliveryTime);
    });
  }, [tasks]);

  const dayName = DAYS_FULL_PT[date.getDay()];
  const dayNum = date.getDate();
  const monthName = MONTHS_PT[date.getMonth()];

  if (sortedTasks.length === 0) {
    return (
      <View style={[styles.dayPage, { width: SCREEN_WIDTH }]}>
        <View style={styles.dayPageHeader}>
          <Text style={[styles.dayPageTitle, { color: colors.text }]}>
            {dayName}
          </Text>
          <Text style={[styles.dayPageSubtitle, { color: colors.textSecondary }]}>
            {dayNum} de {monthName}
          </Text>
        </View>
        <View style={styles.emptyState}>
          <CalendarOff size={48} color={colors.textSecondary} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Sem lembretes
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Nenhum lembrete marcado para este dia.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.dayPage, { width: SCREEN_WIDTH }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 20 }}
      >
        <View style={styles.dayPageHeader}>
          <Text style={[styles.dayPageTitle, { color: colors.text }]}>
            {dayName}
          </Text>
          <Text style={[styles.dayPageSubtitle, { color: colors.textSecondary }]}>
            {dayNum} de {monthName} · {sortedTasks.length} {sortedTasks.length === 1 ? 'lembrete' : 'lembretes'}
          </Text>
        </View>
        {sortedTasks.map(task => (
          <View key={task.id} style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
            <TaskCard
              task={task}
              onPress={() => onTaskPress(task)}
              onToggleComplete={() => onToggleComplete(task)}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
});
DayPage.displayName = 'DayPage';

/** Week strip item — with event dots */
const WeekStripItem = React.memo(({
  startOfWeek,
  selectedDateKey,
  todayKey,
  primaryColor,
  textColor,
  daysWithEvents,
  onDayPress,
}: {
  startOfWeek: Date;
  selectedDateKey: string;
  todayKey: string;
  primaryColor: string;
  textColor: string;
  daysWithEvents: Set<string>;
  onDayPress: (d: Date) => void;
}) => {
  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [startOfWeek]);

  return (
    <View style={{ width: SCREEN_WIDTH, flexDirection: "row", paddingHorizontal: 16 }}>
      {days.map((d, i) => {
        const dayKey = formatDateKey(d);
        const isSelected = dayKey === selectedDateKey;
        const isToday = dayKey === todayKey;
        const hasEvents = daysWithEvents.has(dayKey);
        return (
          <TouchableOpacity
            key={i}
            onPress={() => onDayPress(d)}
            style={[
              styles.dayCell,
              isSelected && { backgroundColor: primaryColor, borderRadius: 20 },
            ]}
          >
            <Text
              style={[
                styles.dayNumber,
                { color: isSelected ? "#FFF" : isToday ? primaryColor : textColor },
                isSelected && { fontFamily: "Montserrat-Bold" },
              ]}
            >
              {d.getDate()}
            </Text>
            {hasEvents && !isSelected && (
              <View style={[styles.eventDot, { backgroundColor: primaryColor }]} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});
WeekStripItem.displayName = 'WeekStripItem';

/** Month grid item */
const MonthGridItem = React.memo(({
  monthDate,
  grid,
  selectedDateKey,
  todayKey,
  primaryColor,
  textColor,
  textSecondaryColor,
  daysWithEvents,
  onDayPress,
}: {
  monthDate: Date;
  grid: (Date | null)[][];
  selectedDateKey: string;
  todayKey: string;
  primaryColor: string;
  textColor: string;
  textSecondaryColor: string;
  daysWithEvents: Set<string>;
  onDayPress: (d: Date) => void;
}) => (
  <View style={{ width: SCREEN_WIDTH }}>
    {grid.map((week, wi) => (
      <View key={wi} style={styles.weekRow}>
        {week.map((d, di) => {
          if (!d) return <View key={di} style={styles.dayCell} />;
          const dayKey = formatDateKey(d);
          const isSelected = dayKey === selectedDateKey;
          const isToday = dayKey === todayKey;
          const isCurrentMonth = d.getMonth() === monthDate.getMonth();
          const hasEvents = daysWithEvents.has(dayKey);
          return (
            <TouchableOpacity
              key={di}
              onPress={() => onDayPress(d)}
              style={[styles.dayCell, isSelected && { backgroundColor: primaryColor, borderRadius: 20 }]}
            >
              <Text
                style={[
                  styles.dayNumber,
                  {
                    color: isSelected ? "#FFF" : isToday ? primaryColor : isCurrentMonth ? textColor : textSecondaryColor,
                  },
                  isSelected && { fontFamily: "Montserrat-Bold" },
                ]}
              >
                {d.getDate()}
              </Text>
              {hasEvents && !isSelected && (
                <View style={[styles.eventDot, { backgroundColor: primaryColor }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    ))}
  </View>
));
MonthGridItem.displayName = 'MonthGridItem';

// ─── Main Component ──────────────────────────────
export default function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { primaryColor, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewingMonth, setViewingMonth] = useState(new Date());
  const today = useMemo(() => normalizeToNoon(new Date()), []);

  const selectedDateKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);
  const todayKey = useMemo(() => formatDateKey(today), [today]);

  const expandProgress = useSharedValue(0);
  const contextY = useSharedValue(0);

  const dayPagerRef = useRef<FlatList>(null);
  const isProgrammaticScroll = useRef(false);

  const colors = useMemo<Colors>(() => ({
    text: isDark ? "#FAFAFA" : "#18181B",
    textSecondary: isDark ? "#A1A1AA" : "#71717A",
    surface: isDark ? "#0A0A0A" : "#FFFFFF",
    surfaceSecondary: isDark ? "#171717" : "#F5F5F5",
    border: isDark ? "#262626" : "#E5E5E5",
    cardBg: isDark ? "#171717" : "#FFFFFF",
    cardBorder: isDark ? "#262626" : "#E5E5E5",
  }), [isDark]);

  const loadTasks = useCallback(async () => {
    const result = await getTasksWithReminders();
    setTasks(result);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks])
  );

  // Tasks indexed by date key
  const taskMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.deliveryDate) continue;
      if (!map.has(t.deliveryDate)) map.set(t.deliveryDate, []);
      map.get(t.deliveryDate)!.push(t);
    }
    return map;
  }, [tasks]);

  const daysWithEvents = useMemo(() => new Set(taskMap.keys()), [taskMap]);

  // ── Day pager data: array of Date objects centered around today ──
  const dayPagerData = useMemo(() => {
    const days: Date[] = [];
    for (let i = -CENTER_INDEX; i <= CENTER_INDEX; i++) {
      days.push(addDays(today, i));
    }
    return days;
  }, [today]);

  // ── Horizontal calendar data ───────────────────
  const monthData = useMemo(() => {
    const months = [];
    const base = new Date(today.getFullYear(), today.getMonth(), 1);
    for (let i = -12; i <= 12; i++) {
      const d = new Date(base);
      d.setMonth(base.getMonth() + i);
      months.push({ date: d, grid: getMonthGrid(d.getFullYear(), d.getMonth()) });
    }
    return months;
  }, [today]);

  const weekData = useMemo(() => {
    const weeks = [];
    const base = getStartOfWeek(today);
    for (let i = -26; i <= 26; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i * 7);
      weeks.push(d);
    }
    return weeks;
  }, [today]);

  const monthFlatListRef = useRef<FlatList>(null);
  const weekFlatListRef = useRef<FlatList>(null);

  // ── Gesture ────────────────────────────────────
  const panGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .failOffsetX([-20, 20])
    .onBegin(() => { contextY.value = expandProgress.value; })
    .onUpdate((e) => {
      const raw = contextY.value + e.translationY / (MONTH_HEIGHT - WEEK_HEIGHT);
      expandProgress.value = Math.max(0, Math.min(1, raw));
    })
    .onEnd((e) => {
      const snap = expandProgress.value > 0.4 || e.velocityY > 500 ? 1 : 0;
      expandProgress.value = withSpring(snap, { damping: 20, stiffness: 200 });
    });

  const calendarAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(expandProgress.value, [0, 1], [WEEK_HEIGHT, MONTH_HEIGHT]),
    overflow: "hidden" as const,
  }));

  const weekOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0, 0.3], [1, 0]),
    position: "absolute" as const,
    top: 0, left: 0, right: 0,
    zIndex: expandProgress.value < 0.5 ? 10 : 0,
  }));

  const monthOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0.3, 0.7], [0, 1]),
    zIndex: expandProgress.value >= 0.5 ? 20 : 0,
    pointerEvents: expandProgress.value >= 0.5 ? "auto" : "none",
  }));

  // ── Sync calendar strips when day changes ──────
  const syncCalendarStrips = useCallback((d: Date) => {
    const monthIndex = monthData.findIndex(m =>
      m.date.getFullYear() === d.getFullYear() && m.date.getMonth() === d.getMonth()
    );
    if (monthIndex !== -1) {
      monthFlatListRef.current?.scrollToIndex({ index: monthIndex, animated: true });
    }

    const startOfWeek = getStartOfWeek(d);
    const weekIndex = weekData.findIndex(w => isSameDay(w, startOfWeek));
    if (weekIndex !== -1) {
      weekFlatListRef.current?.scrollToIndex({ index: weekIndex, animated: true });
    }

    setViewingMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [monthData, weekData]);

  // ── Day press from calendar ────────────────────
  const handleDayPress = useCallback((date: Date) => {
    setSelectedDate(date);

    // Use date-only arithmetic to avoid timezone drift
    const norm = normalizeToNoon(date);
    const todayNorm = normalizeToNoon(today);
    const dayOffset = Math.round((norm.getTime() - todayNorm.getTime()) / 86400000);
    const pagerIndex = CENTER_INDEX + dayOffset;
    if (pagerIndex >= 0 && pagerIndex < dayPagerData.length) {
      isProgrammaticScroll.current = true;
      dayPagerRef.current?.scrollToIndex({ index: pagerIndex, animated: true });
      setTimeout(() => { isProgrammaticScroll.current = false; }, 500);
    }

    syncCalendarStrips(date);
  }, [today, dayPagerData.length, syncCalendarStrips]);

  // ── Day pager swipe handler ────────────────────
  const onDayPagerMomentumEnd = useCallback((e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (index >= 0 && index < dayPagerData.length) {
      const newDate = dayPagerData[index];
      setSelectedDate(newDate);
      syncCalendarStrips(newDate);
    }
  }, [dayPagerData, syncCalendarStrips]);

  // ── Task press → navigate to task detail ───────
  const handleTaskPress = useCallback((task: Task) => {
    router.push(`/task/${task.id}`);
  }, [router]);

  // ── Toggle task complete ───────────────────────
  const handleToggleComplete = useCallback(async (task: Task) => {
    if (task.completed === 1) {
      await uncompleteTask(task.id);
    } else {
      await completeTask(task.id);
    }
    await loadTasks();
  }, [loadTasks]);

  // ── Render items for FlatLists ─────────────────
  const renderDayPage = useCallback(({ item: date }: { item: Date }) => {
    const dateKey = formatDateKey(date);
    const dayTasks = taskMap.get(dateKey) || [];
    return (
      <DayPage
        date={date}
        tasks={dayTasks}
        colors={colors}
        onTaskPress={handleTaskPress}
        onToggleComplete={handleToggleComplete}
        bottomInset={insets.bottom}
      />
    );
  }, [taskMap, colors, handleTaskPress, handleToggleComplete, insets.bottom]);

  const renderWeekItem = useCallback(({ item: startOfWeek }: { item: Date }) => (
    <WeekStripItem
      startOfWeek={startOfWeek}
      selectedDateKey={selectedDateKey}
      todayKey={todayKey}
      primaryColor={primaryColor}
      textColor={colors.text}
      daysWithEvents={daysWithEvents}
      onDayPress={handleDayPress}
    />
  ), [selectedDateKey, todayKey, primaryColor, colors.text, daysWithEvents, handleDayPress]);

  const renderMonthItem = useCallback(({ item: { date: monthDate, grid } }: { item: { date: Date; grid: (Date | null)[][] } }) => (
    <MonthGridItem
      monthDate={monthDate}
      grid={grid}
      selectedDateKey={selectedDateKey}
      todayKey={todayKey}
      primaryColor={primaryColor}
      textColor={colors.text}
      textSecondaryColor={colors.textSecondary}
      daysWithEvents={daysWithEvents}
      onDayPress={handleDayPress}
    />
  ), [selectedDateKey, todayKey, primaryColor, colors.text, colors.textSecondary, daysWithEvents, handleDayPress]);

  // ── Layout helpers ─────────────────────────────
  const getDayPagerLayout = useCallback((_: any, index: number) => ({
    length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index,
  }), []);

  const getHorizontalLayout = useCallback((_: any, index: number) => ({
    length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index,
  }), []);

  const onWeekScrollFail = useCallback((info: any) => {
    setTimeout(() => weekFlatListRef.current?.scrollToIndex({ index: info.index, animated: false }), 100);
  }, []);

  const onMonthScrollFail = useCallback((info: any) => {
    setTimeout(() => monthFlatListRef.current?.scrollToIndex({ index: info.index, animated: false }), 100);
  }, []);

  const onDayPagerScrollFail = useCallback((info: any) => {
    setTimeout(() => dayPagerRef.current?.scrollToIndex({ index: info.index, animated: false }), 100);
  }, []);

  const onWeekMomentumEnd = useCallback((e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (weekData[index]) setViewingMonth(weekData[index]);
  }, [weekData]);

  const onMonthMomentumEnd = useCallback((e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (monthData[index]) setViewingMonth(monthData[index].date);
  }, [monthData]);

  const dayKeyExtractor = useCallback((item: Date) => formatDateKey(item), []);
  const weekKeyExtractor = useCallback((item: Date) => `w-${item.toISOString()}`, []);
  const monthKeyExtractor = useCallback((item: { date: Date }) => `m-${item.date.toISOString()}`, []);

  const HEADER_DAYS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <View style={{ height: insets.top }} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Button variant="icon" onPress={() => router.back()}>
              <Button.Icon icon={<ArrowLeft size={24} color={colors.text} />} />
            </Button>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Agenda</Text>
          </View>
        </View>

        {/* Day labels */}
        <View style={styles.dayLabelsRow}>
          {HEADER_DAYS_SHORT.map((d) => (
            <Text key={d} style={[styles.dayLabel, { color: colors.textSecondary }]}>
              {d}
            </Text>
          ))}
        </View>

        {/* Expandable calendar area */}
        <GestureDetector gesture={panGesture}>
          <View style={{ backgroundColor: colors.surface }}>
            <Animated.View style={calendarAnimatedStyle}>
              {/* Week strip */}
              <Animated.View style={weekOpacity}>
                <FlatList
                  ref={weekFlatListRef}
                  data={weekData}
                  horizontal
                  pagingEnabled
                  initialScrollIndex={26}
                  onScrollToIndexFailed={onWeekScrollFail}
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={onWeekMomentumEnd}
                  keyExtractor={weekKeyExtractor}
                  getItemLayout={getHorizontalLayout}
                  renderItem={renderWeekItem}
                  removeClippedSubviews
                  windowSize={3}
                  maxToRenderPerBatch={3}
                  initialNumToRender={3}
                />
              </Animated.View>

              {/* Month grid */}
              <Animated.View style={monthOpacity}>
                <FlatList
                  ref={monthFlatListRef}
                  data={monthData}
                  horizontal
                  pagingEnabled
                  initialScrollIndex={12}
                  onScrollToIndexFailed={onMonthScrollFail}
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={onMonthMomentumEnd}
                  keyExtractor={monthKeyExtractor}
                  getItemLayout={getHorizontalLayout}
                  renderItem={renderMonthItem}
                  removeClippedSubviews
                  windowSize={3}
                  maxToRenderPerBatch={3}
                  initialNumToRender={3}
                />
              </Animated.View>
            </Animated.View>

            {/* Month label + drag handle */}
            <View style={[styles.monthBar, { borderBottomColor: colors.border }]}>
              <Text style={[styles.monthLabel, { color: colors.textSecondary }]}>
                {MONTHS_PT[viewingMonth.getMonth()]}, {viewingMonth.getFullYear()}
              </Text>
              <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
              <Text style={[styles.weekLabel, { color: colors.textSecondary }]}>
                Semana {getWeekNumber(viewingMonth)}
              </Text>
            </View>
          </View>
        </GestureDetector>

        {/* Day pager — swipe left/right to switch days */}
        <View style={{ flex: 1 }}>
          <FlatList
            ref={dayPagerRef}
            data={dayPagerData}
            horizontal
            pagingEnabled
            initialScrollIndex={CENTER_INDEX}
            onScrollToIndexFailed={onDayPagerScrollFail}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onDayPagerMomentumEnd}
            keyExtractor={dayKeyExtractor}
            getItemLayout={getDayPagerLayout}
            renderItem={renderDayPage}
            removeClippedSubviews
            windowSize={3}
            maxToRenderPerBatch={3}
            initialNumToRender={1}
          />
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

// ─── Styles ──────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontFamily: "Montserrat-Bold", fontSize: 22 },
  dayLabelsRow: { flexDirection: "row", paddingHorizontal: 16, marginBottom: 4 },
  dayLabel: {
    flex: 1,
    textAlign: "center",
    fontFamily: "Montserrat-SemiBold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  weekRow: { flexDirection: "row", paddingHorizontal: 16, height: 44, alignItems: "center" },
  dayCell: { flex: 1, height: 36, width: 36, alignItems: "center", justifyContent: "center" },
  dayNumber: { fontFamily: "Montserrat-SemiBold", fontSize: 15 },
  eventDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 2 },
  monthBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  monthLabel: { fontFamily: "Montserrat-Medium", fontSize: 13 },
  dragHandle: { width: 40, height: 4, borderRadius: 2 },
  weekLabel: { fontFamily: "Montserrat-Medium", fontSize: 13 },
  dayPage: { flex: 1 },
  dayPageHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, gap: 2 },
  dayPageTitle: { fontFamily: "Montserrat-Bold", fontSize: 22 },
  dayPageSubtitle: { fontFamily: "Montserrat-Medium", fontSize: 13, marginTop: 2 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80, gap: 12 },
  emptyTitle: { fontFamily: "Montserrat-Bold", fontSize: 18, marginTop: 4 },
  emptyDesc: { fontFamily: "Montserrat-Regular", fontSize: 13, textAlign: "center", paddingHorizontal: 40 },
});
