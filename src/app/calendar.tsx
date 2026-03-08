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
      <View className="flex-1" style={{ width: SCREEN_WIDTH }}>
        <View className="px-5 pt-5 pb-4 gap-0.5">
          <Text className="font-sans-bold text-[22px]" style={{ color: colors.text }}>
            {dayName}
          </Text>
          <Text className="font-sans-medium text-[13px] mt-0.5" style={{ color: colors.textSecondary }}>
            {dayNum} de {monthName}
          </Text>
        </View>
        <View className="flex-1 items-center justify-center py-20 gap-3">
          <CalendarOff size={48} color={colors.textSecondary} strokeWidth={1.5} />
          <Text className="font-sans-bold text-lg mt-1" style={{ color: colors.text }}>
            Sem lembretes
          </Text>
          <Text className="font-sans text-[13px] text-center px-10" style={{ color: colors.textSecondary }}>
            Nenhum lembrete marcado para este dia.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ width: SCREEN_WIDTH }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 20 }}
      >
        <View className="px-5 pt-5 pb-4 gap-0.5">
          <Text className="font-sans-bold text-[22px]" style={{ color: colors.text }}>
            {dayName}
          </Text>
          <Text className="font-sans-medium text-[13px] mt-0.5" style={{ color: colors.textSecondary }}>
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
    <View className="flex-row px-4" style={{ width: SCREEN_WIDTH }}>
      {days.map((d, i) => {
        const dayKey = formatDateKey(d);
        const isSelected = dayKey === selectedDateKey;
        const isToday = dayKey === todayKey;
        const hasEvents = daysWithEvents.has(dayKey);
        return (
          <TouchableOpacity
            activeOpacity={0.8}
            key={i}
            onPress={() => onDayPress(d)}
            className="flex-1 h-9 items-center justify-center m-0.5"
            style={[
              isSelected && { backgroundColor: primaryColor, borderRadius: 18 },
            ]}
          >
            <Text
              className={`text-[15px] ${isSelected ? 'font-sans-bold' : 'font-sans-semibold'}`}
              style={[
                { color: isSelected ? "#FFF" : isToday ? primaryColor : textColor },
              ]}
            >
              {d.getDate()}
            </Text>
            {hasEvents && !isSelected && (
              <View className="w-1.5 h-1.5 rounded-full mt-0.5" style={[{ backgroundColor: primaryColor }]} />
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
      <View key={wi} className="flex-row px-4 h-11 items-center">
        {week.map((d, di) => {
          if (!d) return <View key={di} className="flex-1 h-9 items-center justify-center" />;
          const dayKey = formatDateKey(d);
          const isSelected = dayKey === selectedDateKey;
          const isToday = dayKey === todayKey;
          const isCurrentMonth = d.getMonth() === monthDate.getMonth();
          const hasEvents = daysWithEvents.has(dayKey);
          return (
            <TouchableOpacity
              key={di}
              onPress={() => onDayPress(d)}
              className="flex-1 h-9 items-center justify-center m-0.5"
              style={[isSelected && { backgroundColor: primaryColor, borderRadius: 18 }]}
            >
              <Text
                className={`text-[15px] ${isSelected ? 'font-sans-bold' : 'font-sans-semibold'}`}
                style={[
                  {
                    color: isSelected ? "#FFF" : isToday ? primaryColor : isCurrentMonth ? textColor : textSecondaryColor,
                  },
                ]}
              >
                {d.getDate()}
              </Text>
              {hasEvents && !isSelected && (
                <View className="w-1.5 h-1.5 rounded-full mt-0.5" style={[{ backgroundColor: primaryColor }]} />
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
      <View className="flex-1" style={[{ backgroundColor: colors.surface }]}>
        <View style={{ height: insets.top }} />

        {/* Header */}
        <View className="flex-row items-center justify-between px-3 py-2">
          <View className="flex-row items-center gap-2">
            <Button variant="icon" onPress={() => router.back()}>
              <Button.Icon icon={<ArrowLeft size={24} color={colors.text} />} />
            </Button>
            <Text className="font-sans-bold text-[22px]" style={{ color: colors.text }}>Agenda</Text>
          </View>
        </View>

        {/* Day labels */}
        <View className="flex-row px-4 mb-1">
          {HEADER_DAYS_SHORT.map((d) => (
            <Text key={d} className="flex-1 text-center font-sans-semibold text-xs uppercase tracking-[0.5px]" style={[{ color: colors.textSecondary }]}>
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
            <View className="flex-row items-center justify-between px-5 py-3 border-b" style={[{ borderBottomColor: colors.border }]}>
              <Text className="font-sans-medium text-[13px]" style={[{ color: colors.textSecondary }]}>
                {MONTHS_PT[viewingMonth.getMonth()]}, {viewingMonth.getFullYear()}
              </Text>
              <View className="w-10 h-1 rounded-sm" style={[{ backgroundColor: colors.border }]} />
              <Text className="font-sans-medium text-[13px]" style={[{ color: colors.textSecondary }]}>
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
