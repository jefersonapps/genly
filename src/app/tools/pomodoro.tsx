import { useTheme } from "@/providers/ThemeProvider";
import { shadows } from "@/theme/shadows";
import { withOpacity } from "@/utils/colors";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ChevronLeft, Coffee, Eye, Minus, Pause, Play, Plus, RotateCcw, Settings, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

type Mode = "focus" | "shortBreak" | "longBreak";

const DEFAULT_FOCUS_TIME = 25 * 60;
const DEFAULT_SHORT_BREAK_TIME = 5 * 60;
const DEFAULT_LONG_BREAK_TIME = 15 * 60;
const DEFAULT_SESSIONS_BEFORE_LONG = 4;

// Component for Setting Row with Hold-to-change support
const SettingRow = React.memo(({ label, value, onPressMinus, onPressPlus, unit = "min", icon: Icon }: any) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isPressing = useRef(false);

  const startChange = (action: () => void) => {
    // Race condition protection: if the user let go before onLongPress fired, do nothing.
    if (!isPressing.current) return;
    
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      action();
    }, 80); // 80ms interval for fast changing
  };

  const stopChange = () => {
    isPressing.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Need to make sure stopChange is called if the component unmounts while pressing
  useEffect(() => {
    return () => stopChange();
  }, []);

  return (
    <View className="flex-row items-center justify-between py-4 px-4">
        <View className="flex-row items-center flex-1">
            {Icon && (
                <View className="w-8 h-8 rounded-full items-center justify-center mr-3" style={{ backgroundColor: isDark ? "#2A2A2A" : "#F0F0F0" }}>
                   <Icon size={16} color={isDark ? "#FFF" : "#000"} />
                </View>
            )}
            <Text className="font-sans-medium text-on-surface text-base flex-1 pr-2" numberOfLines={1}>{label}</Text>
        </View>
        <View className="flex-row items-center bg-surface rounded-full border border-outline/10 ml-2" style={{ padding: 2 }}>
            <TouchableOpacity 
               onPress={onPressMinus}
               onPressIn={() => { isPressing.current = true; }}
               onLongPress={() => startChange(onPressMinus)} 
               onPressOut={stopChange}
               delayLongPress={300}
               activeOpacity={0.8}
               className="w-12 h-10 items-center justify-center rounded-full"
            >
                <Minus size={18} color={isDark ? "#FFF" : "#000"} />
            </TouchableOpacity>
            <Text className="font-sans-bold text-lg w-[70px] text-center text-on-surface" numberOfLines={1}>{value} {unit}</Text>
            <TouchableOpacity 
               onPress={onPressPlus}
               onPressIn={() => { isPressing.current = true; }}
               onLongPress={() => startChange(onPressPlus)} 
               onPressOut={stopChange}
               delayLongPress={300}
               activeOpacity={0.8}
               className="w-12 h-10 items-center justify-center rounded-full"
            >
                <Plus size={18} color={isDark ? "#FFF" : "#000"} />
            </TouchableOpacity>
        </View>
    </View>
  );
});

export default function PomodoroScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Config
  const [focusTime, setFocusTime] = useState(DEFAULT_FOCUS_TIME);
  const [shortBreakTime, setShortBreakTime] = useState(DEFAULT_SHORT_BREAK_TIME);
  const [longBreakTime, setLongBreakTime] = useState(DEFAULT_LONG_BREAK_TIME);
  const [sessionsBeforeLong, setSessionsBeforeLong] = useState(DEFAULT_SESSIONS_BEFORE_LONG);

  // State
  const [mode, setMode] = useState<Mode>("focus");
  const [timeLeft, setTimeLeft] = useState(focusTime);
  const [isActive, setIsActive] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  // Refs for tracking changes
  const lastTickTime = useRef<number>(Date.now());

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && timeLeft > 0) {
      lastTickTime.current = Date.now();
      interval = setInterval(() => {
        const now = Date.now();
        const delta = Math.floor((now - lastTickTime.current) / 1000);
        if (delta > 0) {
          setTimeLeft((time) => Math.max(0, time - delta));
          lastTickTime.current = now;
        }
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      // Auto-switch mode
      setIsActive(false);
      handleSessionEnd();
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeLeft]);

  const handleSessionEnd = () => {
    let nextMode: Mode = "focus";
    let nextTime = focusTime;

    if (mode === "focus") {
      const newSessions = completedSessions + 1;
      setCompletedSessions(newSessions);
      
      if (newSessions % sessionsBeforeLong === 0) {
        nextMode = "longBreak";
        nextTime = longBreakTime;
      } else {
        nextMode = "shortBreak";
        nextTime = shortBreakTime;
      }
    } else {
      nextMode = "focus";
      nextTime = focusTime;
    }

    setMode(nextMode);
    setTimeLeft(nextTime);
    setIsActive(true); // Auto-start the next mode
  };

  const toggleTimer = () => {
    if (!isActive) lastTickTime.current = Date.now();
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    if (mode === "focus") setTimeLeft(focusTime);
    else if (mode === "shortBreak") setTimeLeft(shortBreakTime);
    else setTimeLeft(longBreakTime);
  };

  const handleResetSettings = () => {
    setFocusTime(DEFAULT_FOCUS_TIME);
    setShortBreakTime(DEFAULT_SHORT_BREAK_TIME);
    setLongBreakTime(DEFAULT_LONG_BREAK_TIME);
    setSessionsBeforeLong(DEFAULT_SESSIONS_BEFORE_LONG);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const syncTimeLeft = () => {
    if (mode === "focus") setTimeLeft(focusTime);
    else if (mode === "shortBreak") setTimeLeft(shortBreakTime);
    else setTimeLeft(longBreakTime);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const currentTotal = mode === "focus" ? focusTime : mode === "shortBreak" ? shortBreakTime : longBreakTime;
  const progress = currentTotal > 0 ? ((currentTotal - timeLeft) / currentTotal) : 0;

  // Ring specs
  const strokeWidth = 14;
  const radius = 130;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;

  const modeColors = {
    focus: { start: primaryColor, end: withOpacity(primaryColor, 0.53), bg: isDark ? "#1C1C1E" : "#FFF", text: "Foco" },
    shortBreak: { start: "#FF9500", end: withOpacity("#FF9500", 0.53), bg: isDark ? "#1C1C1E" : "#FFF", text: "Pausa Curta" },
    longBreak: { start: "#FF3B30", end: withOpacity("#FF3B30", 0.53), bg: isDark ? "#1C1C1E" : "#FFF", text: "Pausa Longa" }
  };

  const currentColor = modeColors[mode];

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-4 py-2">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface-secondary/50"
        >
          <ChevronLeft size={24} color={isDark ? "#FFF" : "#000"} />
        </TouchableOpacity>
        <Text className="font-sans-bold text-lg text-on-surface">Timer Pomodoro</Text>
        <View className="w-10" />
      </View>

      <View className="flex-1 items-center justify-center px-4" style={{ paddingBottom: 60 }}>
          
         {/* Timer Ring */}
         <View className="relative items-center justify-center mb-16">
            <Svg width={radius * 2 + strokeWidth * 2} height={radius * 2 + strokeWidth * 2}>
              <Defs>
                <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={currentColor.end} stopOpacity="1" />
                  <Stop offset="1" stopColor={currentColor.start} stopOpacity="1" />
                </LinearGradient>
              </Defs>
              {/* Background Circle */}
              <Circle
                stroke={isDark ? "#2A2A2A" : "#E5E5E5"}
                fill={currentColor.bg}
                cx={radius + strokeWidth}
                cy={radius + strokeWidth}
                r={radius}
                strokeWidth={strokeWidth}
              />
              {/* Progress Circle */}
              <Circle
                stroke="url(#grad)"
                fill="none"
                cx={radius + strokeWidth}
                cy={radius + strokeWidth}
                r={radius}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${radius + strokeWidth} ${radius + strokeWidth})`}
              />
            </Svg>

            {/* Inner Content */}
            <View className="absolute items-center justify-center" style={{ top: 0, bottom: 0, left: 0, right: 0 }}>
               { mode === 'focus' ? (
                   <Eye size={24} color={isDark ? "#FFF" : "#000"} style={{ opacity: 0.6, marginBottom: 8 }} />
               ) : (
                   <Coffee size={24} color={isDark ? "#FFF" : "#000"} style={{ opacity: 0.6, marginBottom: 8 }} />
               )}
               <Text style={{ color: isDark ? "#FFF" : "#000", fontSize: 64, letterSpacing: 2, lineHeight: 70 }} className="font-sans-bold">
                    {formatTime(timeLeft)}
               </Text>
               <View className="flex-row items-center mt-2 gap-1 mb-2">
                   {/* Session Indicators */}
                   {Array.from({ length: sessionsBeforeLong }).map((_, i) => (
                       <View 
                           key={i} 
                           className="w-2 h-2 rounded-full" 
                           style={{ backgroundColor: i < completedSessions % sessionsBeforeLong ? currentColor.start : (isDark ? "#333" : "#DDD") }}
                       />
                   ))}
               </View>
               <Text className="font-sans-medium text-on-surface-secondary text-sm uppercase tracking-widest mt-1">
                    {currentColor.text}
               </Text>
            </View>
         </View>

         {/* Bottom Controls */}
         <View className="flex-row items-center justify-between w-full px-8 maxWidth-[400px]">
            <TouchableOpacity 
                activeOpacity={0.8}
                onPress={resetTimer}
                className="h-14 w-14 items-center justify-center rounded-full bg-surface-secondary"
                style={[{ borderWidth: 1, borderColor: isDark ? "#333" : "#E5E5E5" }, shadows.sm]}
            >
                <RotateCcw size={22} color={isDark ? "#CCC" : "#555"} />
            </TouchableOpacity>

            <TouchableOpacity 
                onPress={toggleTimer}
                activeOpacity={0.8}
                className="h-24 w-24 items-center justify-center rounded-full"
                style={[{ backgroundColor: isActive ? (isDark ? "#333" : "#E5E5E5") : currentColor.start }, shadows.md]}
            >
                {isActive ? (
                    <Pause size={40} color={isDark ? "#FFF" : "#000"} fill={isDark ? "#FFF" : "#000"} />
                ) : (
                    <Play size={40} color="#FFF" fill="#FFF" />
                )}
            </TouchableOpacity>

            <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => setShowSettings(true)}
                className="h-14 w-14 items-center justify-center rounded-full bg-surface-secondary"
                style={[{ borderWidth: 1, borderColor: isDark ? "#333" : "#E5E5E5" }, shadows.sm]}
            >
                <Settings size={22} color={isDark ? "#CCC" : "#555"} />
            </TouchableOpacity>
         </View>
      </View>

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => {
          setShowSettings(false);
          if (!isActive) syncTimeLeft();
      }}>
         <View className="flex-1 bg-surface" style={{ paddingTop: isDark ? 20 : insets.top }}>
             <View className="flex-row items-center justify-between px-6 py-4 border-b border-outline/10">
                 <Text className="font-sans-bold text-2xl text-on-surface">Configurações</Text>
                 <TouchableOpacity activeOpacity={0.8} onPress={() => { setShowSettings(false); if (!isActive) syncTimeLeft(); }} className="w-10 h-10 items-center justify-center rounded-full bg-surface-secondary">
                     <X size={24} color={isDark ? "#FFF" : "#000"} />
                 </TouchableOpacity>
             </View>

             <ScrollView className="px-6 mt-4 pb-20">
                 <Text className="font-sans-bold text-lg text-on-surface mb-2 mt-4">Tempo das Sessões</Text>
                 <View className="overflow-hidden rounded-2xl bg-surface-secondary">
                     <SettingRow 
                         label="Sessão de Foco" 
                         value={Math.floor(focusTime / 60)} 
                         icon={Eye}
                         onPressMinus={() => setFocusTime(prev => Math.max(60, prev - 60))}
                         onPressPlus={() => setFocusTime(prev => Math.min(120 * 60, prev + 60))}
                     />
                     <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
                     <SettingRow 
                         label="Pausa Curta" 
                         value={Math.floor(shortBreakTime / 60)} 
                         icon={Coffee}
                         onPressMinus={() => setShortBreakTime(prev => Math.max(60, prev - 60))}
                         onPressPlus={() => setShortBreakTime(prev => Math.min(30 * 60, prev + 60))}
                     />
                     <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
                     <SettingRow 
                         label="Pausa Longa" 
                         value={Math.floor(longBreakTime / 60)} 
                         icon={Coffee}
                         onPressMinus={() => setLongBreakTime(prev => Math.max(60, prev - 60))}
                         onPressPlus={() => setLongBreakTime(prev => Math.min(60 * 60, prev + 60))}
                     />
                     <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
                     <SettingRow 
                         label="Pausa Longa a cada" 
                         value={sessionsBeforeLong} 
                         unit="sess."
                         icon={RotateCcw}
                         onPressMinus={() => setSessionsBeforeLong(prev => Math.max(1, prev - 1))}
                         onPressPlus={() => setSessionsBeforeLong(prev => Math.min(10, prev + 1))}
                     />
                 </View>

                 <TouchableOpacity 
                   activeOpacity={0.8}
                   onPress={handleResetSettings}
                   className="mt-8 flex-row items-center justify-center py-4 rounded-2xl bg-surface-secondary border border-outline/5"
                 >
                   <RotateCcw size={18} color={isDark ? "#A1A1AA" : "#71717A"} />
                   <Text className="font-sans-medium text-on-surface-secondary ml-2">Resetar Configurações</Text>
                 </TouchableOpacity>
             </ScrollView>
         </View>
      </Modal>

    </View>
  );
}
