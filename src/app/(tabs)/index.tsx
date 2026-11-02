import { useDeferredFocusEffect } from "@/hooks/useDeferredFocusEffect";
import { GroupIcon } from "@/components/ui/GroupIcon";
import { SwipeableTaskRow, type TaskRowKind } from "@/components/task/SwipeableTaskRow";
import type { NoteSwipeableMethods } from "@/components/task/NoteSwipeable";
import { Avatar } from "@/components/ui/Avatar";
import BottomSheet from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { CardGradient } from "@/components/ui/CardGradient";
import { EmptyState } from "@/components/ui/EmptyState";
import { GroupChipList } from "@/components/ui/GroupChipList";
import { TabHeader } from "@/components/ui/TabHeader";
import { BLUR_CONFIG } from "@/config/blurConfig";
import type { Group, Media, Task } from "@/db/schema";
import { useHeaderSnap } from "@/hooks/useHeaderSnap";
import { useDialog } from "@/providers/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { getSetting } from "@/services/settingsService";
import { completeTask, deleteGroup, deleteTask, deleteTasks, getAllGroups, getAllTasks, getAllTaskMedia, getTaskById, uncompleteTask } from "@/services/taskService";
import { shadows } from "@/theme/shadows";
import { adjustColor, withOpacity } from "@/utils/colors";
import { getGreeting } from "@/utils/date";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { Bell, Brain, CalendarDays, CheckCheck, Clock, Edit3, FileText, FolderPlus, Layers, Lightbulb, Plus, Search, Trash2, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, RefreshControl, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import Animated, {
    Extrapolation,
    interpolate,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";


const GERAL_CARD_THEME = {
  colors: {
    primary: '#C491F1',  
    secondary: '#F4A261', 
    tertiary: '#50B0F9',
  }
};

const taskKey = (task: Task) => String(task.id);
const TaskSeparator = () => <View style={{ height: 8 }} />;

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList<Task>);

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const dialog = useDialog();
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(() => new Set());
  const [deletingSelection, setDeletingSelection] = useState(false);
  const deletionInFlight = useRef(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [taskMedia, setTaskMedia] = useState<Record<number, Media[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [selectedLongPressGroup, setSelectedLongPressGroup] = useState<Group | null>(null);
  const bottomSheetModalRef = React.useRef<BottomSheetModal>(null);
  const snapPoints = React.useMemo(() => ["35%"], []);

  // Animation values for the "fan" effect
  const fanProgress = useSharedValue(0);
  const { scrollY, headerScrollY, scrollHandler } = useHeaderSnap({ snapThreshold: 60 });
  const scrollViewRef = React.useRef<FlashListRef<Task>>(null);
  const contentHeight = useSharedValue(0);
  const layoutHeight = useSharedValue(0);
  const groupsScrollRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
  const { width: screenWidth } = useWindowDimensions();
  
  // Store exact native coordinates to perfectly scroll horizontally on all devices
  const groupCardLayouts = React.useRef<Record<string, { x: number, width: number }>>({});

  const MIN_CARD_WIDTH = screenWidth * 0.45;

  // Sticky chips threshold — must be declared before scroll handler
  const STICKY_CHIPS_THRESHOLD: [number, number] = [350, 420];
  const stickyChipsProgress = useSharedValue(0);

  // We inject custom onScroll logic directly to `FlashList` by intercepting the events 
  // without losing our generic useHeaderSnap hook behaviors. Since useHeaderSnap creates
  // a useAnimatedScrollHandler internally, but doesn't expose the raw functions cleanly for TS
  // we will manually trigger the shared value updates here for the generic header, plus our custom chip logic.
  const customScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = Math.max(0, event.contentOffset.y);
      scrollY.value = y;
      headerScrollY.value = y;
      
      // Sticky Chips Progress (Index specific)
      const maxScroll = contentHeight.value - layoutHeight.value;
      const canShow = maxScroll > STICKY_CHIPS_THRESHOLD[0] ? 1 : 0;
      stickyChipsProgress.value = interpolate(
        y,
        STICKY_CHIPS_THRESHOLD,
        [0, 1],
        Extrapolation.CLAMP
      ) * canShow;
    },
    onEndDrag: (event) => {
      // 1. Generic Header Snap
      const y = event.contentOffset.y;
      if (y > 0 && y < 60) {
        headerScrollY.value = withTiming(y >= 30 ? 60 : 0, { duration: 200 });
      }

      // 2. Sticky Chips Snap
      const p = stickyChipsProgress.value;
      if (p > 0 && p < 1) {
        stickyChipsProgress.value = withTiming(p >= 0.5 ? 1 : 0, { duration: 200 });
      }
    },
    onMomentumEnd: (event) => {
      // 1. Generic Header Snap
      const y = event.contentOffset.y;
      if (y > 0 && y < 60) {
        headerScrollY.value = withTiming(y >= 30 ? 60 : 0, { duration: 200 });
      }

      // 2. Sticky Chips Snap
      const p = stickyChipsProgress.value;
      if (p > 0 && p < 1) {
        stickyChipsProgress.value = withTiming(p >= 0.5 ? 1 : 0, { duration: 200 });
      }
    },
  });

  useEffect(() => {
    fanProgress.value = withDelay(400, withSpring(1, { damping: 12, stiffness: 90 }));
  }, []);

  const leftCardStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${fanProgress.value * -12}deg` },
      { translateX: fanProgress.value * -22 },
      { translateY: fanProgress.value * 6 }
    ]
  }));

  const rightCardStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${fanProgress.value * 12}deg` },
      { translateX: fanProgress.value * 22 },
      { translateY: fanProgress.value * 6 }
    ]
  }));

  const centerCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: fanProgress.value * -4 }
    ]
  }));

  // Sticky group chips: animated style reading from the snappable progress value
  const stickyChipsStyle = useAnimatedStyle(() => {
    const p = stickyChipsProgress.value;
    return {
      opacity: p,
      maxHeight: p * 50,
      paddingVertical: p * 8,
      overflow: 'hidden' as const,
      transform: [{ translateY: interpolate(p, [0, 1], [-8, 0]) }],
    };
  });

  const activeSwipeRow = useRef<NoteSwipeableMethods | null>(null);
  const pendingCompletions = useRef(new Set<number>());
  const loadVersion = useRef(0);
  const closeSwipeRow = useCallback(() => {
    activeSwipeRow.current?.close();
    activeSwipeRow.current = null;
  }, []);

  const loadData = useCallback(async () => {
    if (deletionInFlight.current) return;
    const version = ++loadVersion.current;
    try {
      const [name, img, allTasks, allGroups, mediaMap] = await Promise.all([
        getSetting("profile_name"), getSetting("profile_image"),
        getAllTasks(), getAllGroups(), getAllTaskMedia(),
      ]);
      if (version !== loadVersion.current) return;
      setProfileName(name);
      setProfileImage(img);
      setTasks(allTasks);
      setGroups(allGroups);
      setTaskMedia(mediaMap);
    } finally {
      if (version === loadVersion.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useDeferredFocusEffect(useCallback(() => {
    loadData();
    return () => { loadVersion.current++; closeSwipeRow(); };
  }, [loadData, closeSwipeRow]));

  const handleCreateGroup = () => {
    router.push("/group/editor");
  };

  const handleLongPressGroup = (group: Group) => {
    setSelectedLongPressGroup(group);
    bottomSheetModalRef.current?.present();
  };

  const handleDeleteGroup = async () => {
    if (!selectedLongPressGroup) return;

    dialog.show({
      title: "Excluir Grupo",
      description: `Tem certeza que deseja excluir o grupo "${selectedLongPressGroup.name}"? As notas não serão excluídas.`,
      buttons: [
        { text: "Cancelar", variant: "ghost" },
        {
          text: "Excluir",
          variant: "destructive",
          onPress: async () => {
            await deleteGroup(selectedLongPressGroup.id);
            bottomSheetModalRef.current?.dismiss();
            loadData();
          },
        },
      ],
    });
  };

  const handleEditGroup = () => {
    if (!selectedLongPressGroup) return;
    bottomSheetModalRef.current?.dismiss();
    router.push({ pathname: "/group/editor", params: { id: selectedLongPressGroup.id } });
  };

  const handleDeleteTask = useCallback((task: Task) => {
    dialog.show({
        title: "Apagar tarefa",
        description: "Tem certeza que deseja apagar esta tarefa?",
        buttons: [
            { text: "Cancelar", variant: "ghost" },
            {
                text: "Apagar",
                variant: "destructive",
                onPress: async () => {
                   await deleteTask(task.id);
                   setTasks(current => current.filter(item => item.id !== task.id));
                   setTaskMedia(current => {
                     const next = { ...current };
                     delete next[task.id];
                     return next;
                   });
                }
            }
        ]
    });
  }, [dialog]);

  // renderBackdrop removed, handled by BottomSheet component

  const filteredTasks = useMemo(() => {
    const query = searchQuery.toLocaleLowerCase('pt-BR');
    return tasks.filter(task => (selectedGroupId === null || task.groupId === selectedGroupId) &&
      (!query || task.title.toLocaleLowerCase('pt-BR').includes(query) || task.content?.toLocaleLowerCase('pt-BR').includes(query)));
  }, [tasks, selectedGroupId, searchQuery]);
  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedTaskIds(new Set());
  }, []);
  useFocusEffect(useCallback(() => () => exitSelection(), [exitSelection]));
  useEffect(() => {
    if (!selectionMode) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!deletionInFlight.current) exitSelection();
      return true;
    });
    return () => subscription.remove();
  }, [selectionMode, exitSelection]);
  useEffect(() => {
    const visibleIds = new Set(filteredTasks.map(task => task.id));
    setSelectedTaskIds(current => {
      const next = new Set([...current].filter(id => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [filteredTasks]);
  const startSelection = useCallback((task: Task) => {
    closeSwipeRow();
    setSelectedTaskIds(new Set([task.id]));
    setSelectionMode(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [closeSwipeRow]);
  const toggleSelection = useCallback((task: Task) => {
    if (deletionInFlight.current) return;
    setSelectedTaskIds(current => {
      const next = new Set(current);
      if (next.has(task.id)) next.delete(task.id);
      else next.add(task.id);
      return next;
    });
  }, []);
  const allSelected = filteredTasks.length > 0 && selectedTaskIds.size === filteredTasks.length;
  const selectAll = () => setSelectedTaskIds(allSelected ? new Set() : new Set(filteredTasks.map(task => task.id)));
  const confirmDeleteSelection = () => {
    if (selectedTaskIds.size === 0 || deletionInFlight.current) return;
    const ids = [...selectedTaskIds];
    dialog.show({
      title: ids.length === 1 ? 'Excluir nota?' : `Excluir ${ids.length} notas?`,
      description: 'As notas selecionadas e seus anexos serão excluídos. Esta ação não pode ser desfeita.',
      buttons: [
        { text: 'Cancelar', variant: 'ghost' },
        { text: 'Excluir', variant: 'destructive', onPress: async () => {
          if (deletionInFlight.current) return;
          deletionInFlight.current = true;
          setDeletingSelection(true);
          // Ignore any refresh that began before the deletion.
          loadVersion.current++;
          try {
            await deleteTasks(ids);
            loadVersion.current++;
            const deleted = new Set(ids);
            setTasks(current => current.filter(task => !deleted.has(task.id)));
            setTaskMedia(current => Object.fromEntries(Object.entries(current).filter(([id]) => !deleted.has(Number(id)))));
            exitSelection();
          } catch (error) {
            console.error('Failed to delete selected notes', error);
            // Let the confirmation close before showing a new modal.
            setTimeout(() => dialog.show({ title: 'Não foi possível excluir', description: 'Tente novamente. Suas notas continuam selecionadas.', variant: 'error' }), 0);
          } finally {
            deletionInFlight.current = false;
            setDeletingSelection(false);
            setRefreshing(false);
          }
        } },
      ],
    });
  };
  const groupKinds = useMemo(() => new Map(groups.map(group => [group.id,
    group.name === 'Mapas Mentais' ? 'mind-map' : group.name === 'Flashcards' ? 'flashcards' : 'note',
  ] as [number, TaskRowKind])), [groups]);
  const groupCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const task of tasks) if (task.groupId !== null) counts.set(task.groupId, (counts.get(task.groupId) || 0) + 1);
    return counts;
  }, [tasks]);
  const toggleComplete = useCallback(async (task: Task) => {
    if (pendingCompletions.current.has(task.id)) return;
    pendingCompletions.current.add(task.id);
    try {
      if (task.completed === 1) await uncompleteTask(task.id);
      else await completeTask(task.id);
      const updated = await getTaskById(task.id);
      if (updated) setTasks(current => current.map(item => item.id === updated.id ? updated : item));
    } finally {
      pendingCompletions.current.delete(task.id);
    }
  }, []);
  const renderTask = useCallback(({ item }: { item: Task }) => (
    <SwipeableTaskRow task={item} kind={groupKinds.get(item.groupId ?? -1) || 'note'} mediaItems={taskMedia[item.id]} activeRow={activeSwipeRow} onDelete={handleDeleteTask} onToggleComplete={toggleComplete}
      selectionMode={selectionMode} selected={selectedTaskIds.has(item.id)} onStartSelection={startSelection} onSelect={toggleSelection} />
  ), [groupKinds, taskMedia, handleDeleteTask, toggleComplete, selectionMode, selectedTaskIds, startSelection, toggleSelection]);


  return (
    <View className="flex-1 bg-surface">
      <View 
        style={{ 
          flex: 1, 
          backgroundColor: isDark ? '#0a0a0a' : '#ffffff' 
        }}
      >
            <AnimatedFlashList
                ref={scrollViewRef}
                onScroll={customScrollHandler}
                scrollEventThrottle={16}
                className="flex-1"
                showsVerticalScrollIndicator={false}
                overScrollMode="never"
                bounces={false}
                onContentSizeChange={(_w, h) => { contentHeight.value = h; }}
                onLayout={(e) => { layoutHeight.value = e.nativeEvent.layout.height; }}
                contentContainerStyle={{ 
                    paddingTop: 0, 
                    paddingBottom: 140 + insets.bottom
                }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); loadData(); }}
                        progressViewOffset={insets.top + 80}
                    />
                }
                data={filteredTasks}
                maintainVisibleContentPosition={{ disabled: true }}
                ListHeaderComponent={
                  <>
                    {/* Spacer block to replace content padding — crucial for RefreshControl stability on Android */}
                    <View style={{ height: insets.top + 80 }} />
                    
                    <View className="px-6">
                        <Text className="font-sans text-on-surface-secondary text-base">{getGreeting(profileName)}</Text>
                        <Text className="font-sans-bold text-3xl text-on-surface mt-1">Sua Biblioteca</Text>
                    </View>

                    {/* Dynamic Groups Selection */}
                    <View className="mt-4">
                         <ScrollView ref={groupsScrollRef} horizontal showsHorizontalScrollIndicator={false} className="pl-6 overflow-visible">
                            {/* "All" Group Card */}
                            <TouchableOpacity 
                                activeOpacity={0.8}
                                onPress={() => setSelectedGroupId(null)}
                                onLayout={(e) => {
                                    groupCardLayouts.current['geral'] = {
                                        x: e.nativeEvent.layout.x,
                                        width: e.nativeEvent.layout.width,
                                    };
                                }}
                                className={`mr-5 h-72 w-56 rounded-[3rem] border p-6 justify-between overflow-hidden`}
                                style={{ 
                                    backgroundColor: isDark ? '#18181b' : '#f4f4f5',
                                    borderColor: selectedGroupId === null ? withOpacity(primaryColor, 0.5) : (isDark ? '#27272a' : '#e4e4e7')
                                }}
                            >
                                    <CardGradient 
                                        color={primaryColor}
                                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.5 }} 
                                    />
                                    
                                    <View className="h-40 items-center justify-center relative">
                                        <Animated.View 
                                            className="absolute h-[130px] w-24 rounded-2xl z-0 overflow-hidden" 
                                            style={[
                                                leftCardStyle,
                                                { backgroundColor: withOpacity(GERAL_CARD_THEME.colors.primary, isDark ? 0.6 : 0.8) }
                                            ]}
                                        >
                                            <BlurView 
                                                intensity={BLUR_CONFIG.cards.intensity} 
                                                tint={isDark ? 'dark' : 'light'} 
                                                blurMethod={BLUR_CONFIG.cards.blurMethod}
                                                blurReductionFactor={BLUR_CONFIG.cards.blurReductionFactor}
                                                style={{ flex: 1 }}
                                            />
                                        </Animated.View>
                                        <Animated.View 
                                            className="absolute h-[130px] w-24 rounded-2xl z-10 overflow-hidden" 
                                            style={[
                                                rightCardStyle,
                                                { backgroundColor: withOpacity(GERAL_CARD_THEME.colors.tertiary, isDark ? 0.6 : 0.8) }
                                            ]}
                                        >
                                            <BlurView 
                                                intensity={BLUR_CONFIG.cards.intensity} 
                                                tint={isDark ? 'dark' : 'light'} 
                                                blurMethod={BLUR_CONFIG.cards.blurMethod}
                                                blurReductionFactor={BLUR_CONFIG.cards.blurReductionFactor}
                                                style={{ flex: 1 }}
                                            />
                                        </Animated.View>
                                        <Animated.View 
                                            className="h-[140px] w-28 rounded-2xl border border-white/20 z-20 overflow-hidden" 
                                            style={[
                                                centerCardStyle,
                                                { backgroundColor: withOpacity(GERAL_CARD_THEME.colors.secondary, isDark ? 0.85 : 0.95) },
                                                shadows.xl
                                            ]}
                                        >
                                            <BlurView 
                                                intensity={BLUR_CONFIG.cards.intensity} 
                                                tint={isDark ? 'dark' : 'light'} 
                                                blurMethod={BLUR_CONFIG.cards.blurMethod}
                                                blurReductionFactor={BLUR_CONFIG.cards.blurReductionFactor}
                                                style={{ flex: 1 }}
                                            />
                                        </Animated.View>
                                    </View>

                                    
                                    {/* Bottom Row: Text and FAB */}
                                    <View className="flex-row items-end justify-between w-full">
                                        <View>
                                            <Text className="font-sans-bold text-xl text-on-surface">Geral</Text>
                                            <Text className="font-sans text-sm text-on-surface-secondary mt-1">{tasks.length} Notas</Text>
                                        </View>
                                        
                                        {/* FAB Container (No Glow) */}
                                        <View className="items-center justify-center relative w-12 h-12">
                                            <TouchableOpacity 
                                                activeOpacity={0.8} 
                                                className="rounded-full w-12 h-12 items-center justify-center"
                                                style={{
                                                    backgroundColor: primaryColor,
                                                    borderWidth: 1,
                                                    borderColor: adjustColor(primaryColor, -20),
                                                }}
                                                onPress={() => router.push("/task/editor")}
                                            >
                                            <Plus size={22} color="#FFF" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            {/* Dynamic Groups */}
                            {groups.map((group, index) => (
                                <TouchableOpacity 
                                    key={group.id}
                                    activeOpacity={0.8} 
                                    onPress={() => setSelectedGroupId(group.id)}
                                    onLongPress={() => handleLongPressGroup(group)}
                                    onLayout={(e) => {
                                        groupCardLayouts.current[group.id.toString()] = {
                                            x: e.nativeEvent.layout.x,
                                            width: e.nativeEvent.layout.width,
                                        };
                                    }}
                                    className={`mr-5 h-72 w-56 rounded-[3rem] border p-6 justify-between overflow-hidden`}
                                    style={{ 
                                        backgroundColor: isDark ? '#18181b' : '#f4f4f5',
                                        borderColor: selectedGroupId === group.id ? withOpacity(primaryColor, 0.5) : (isDark ? '#27272a' : '#e4e4e7')
                                    }}
                                >
                                        <CardGradient 
                                            color={group.color || (isDark ? '#52525b' : '#a1a1aa')} 
                                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.5 }} 
                                        />

                                        <View className="h-40 items-center justify-center relative">
                                            {/* Glassmorphic Custom Cards */}
                                            <Animated.View 
                                                className="absolute h-[130px] w-24 rounded-2xl z-0 overflow-hidden" 
                                                style={[
                                                    leftCardStyle,
                                                    { backgroundColor: group.color ? `${group.color}${isDark ? '66' : '99'}` : (isDark ? '#6366f166' : '#6366f199') }
                                                ]}
                                            >
                                                <BlurView 
                                                    intensity={BLUR_CONFIG.cards.intensity} 
                                                    tint={isDark ? 'dark' : 'light'}
                                                    blurMethod={BLUR_CONFIG.cards.blurMethod}
                                                    blurReductionFactor={BLUR_CONFIG.cards.blurReductionFactor}
                                                    style={{ flex: 1 }}
                                                />
                                            </Animated.View>
                                            <Animated.View 
                                                className="absolute h-[130px] w-24 rounded-2xl z-10 overflow-hidden" 
                                                style={[
                                                    rightCardStyle,
                                                    { backgroundColor: group.color ? `${group.color}${isDark ? '88' : 'BB'}` : (isDark ? '#6366f188' : '#6366f1BB') }
                                                ]}
                                            >
                                                <BlurView 
                                                    intensity={BLUR_CONFIG.cards.intensity} 
                                                    tint={isDark ? 'dark' : 'light'}
                                                    blurMethod={BLUR_CONFIG.cards.blurMethod}
                                                    blurReductionFactor={BLUR_CONFIG.cards.blurReductionFactor}
                                                    style={{ flex: 1 }}
                                                />
                                            </Animated.View>
                                            <Animated.View 
                                                className="h-[140px] w-28 rounded-2xl border border-white/20 items-center justify-center z-20 overflow-hidden" 
                                                style={[
                                                    centerCardStyle,
                                                    { backgroundColor: group.color ? `${group.color}${isDark ? 'cc' : 'FF'}` : (isDark ? '#6366f1cc' : '#6366f1FF') },
                                                    shadows.xl
                                                ]}
                                            >
                                                <BlurView 
                                                    intensity={BLUR_CONFIG.cards.intensity} 
                                                    tint={isDark ? 'dark' : 'light'}
                                                    blurMethod={BLUR_CONFIG.cards.blurMethod}
                                                    blurReductionFactor={BLUR_CONFIG.cards.blurReductionFactor}
                                                    style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <GroupIcon value={group.emoji} size={40} color="#ffffff" />
                                                </BlurView>
                                            </Animated.View>
                                        </View>

                                        
                                        {/* Bottom Row: Text and FAB */}
                                        <View className="flex-row items-end justify-between w-full">
                                            <View className="flex-1 mr-2">
                                                <Text className="font-sans-bold text-xl text-on-surface" numberOfLines={1}>{group.name}</Text>
                                                <Text className="font-sans text-sm text-on-surface-secondary mt-1">
                                                    {groupCounts.get(group.id) || 0} Notas
                                                </Text>
                                            </View>
                                            
                                             {/* FAB Container (No Glow) */}
                                            <View className="items-center justify-center relative w-12 h-12">
                                                <TouchableOpacity 
                                                    activeOpacity={0.8}
                                                    className="rounded-full w-12 h-12 items-center justify-center"
                                                    style={{
                                                        backgroundColor: primaryColor,
                                                        borderWidth: 1,
                                                        borderColor: adjustColor(primaryColor, -20),
                                                    }}
                                                    onPress={() => {
                                                        if (group.name === "Mapas Mentais") {
                                                            router.push({ pathname: "/tools/mind-map", params: { groupId: group.id } });
                                                        } else if (group.name === "Flashcards") {
                                                            router.push({ pathname: "/tools/flashcards", params: { groupId: group.id } });
                                                        } else {
                                                            router.push({ pathname: "/task/editor", params: { groupId: group.id } });
                                                        }
                                                    }}
                                                >
                                                    <Plus size={22} color="#FFF" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                            ))}

                            <TouchableOpacity 
                                activeOpacity={0.8}
                                onPress={handleCreateGroup}
                                className="mr-10 h-72 w-56 rounded-[3rem] bg-surface-secondary border border-dashed border-border p-6 items-center justify-center"
                            >
                                <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: withOpacity(primaryColor, 0.08) }}>
                                    <FolderPlus size={32} color={primaryColor} />
                                </View>
                                <Text className="mt-4 font-sans-bold text-base text-on-surface">Novo Grupo</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>

                    {/* Section Header */}
                    <View className="mt-6 px-6 flex-row items-center justify-between mb-2">
                        <View>
                            <Text className="font-sans-bold text-2xl text-on-surface">
                                {selectedGroupId ? groups.find(g => g.id === selectedGroupId)?.name : "Recentes"}
                            </Text>
                            {filteredTasks.length > 0 && <Text className="font-sans text-sm text-on-surface-secondary">{filteredTasks.length} Notas</Text>}
                        </View>
                        {!selectedGroupId && (
                          <Button variant="icon" onPress={() => router.push("/calendar")}>
                            <Button.Icon icon={<CalendarDays size={24} color={resolvedTheme === 'dark' ? '#FAFAFA' : '#18181B'} />} />
                          </Button>
                        )}
                    </View>
                  </>
                }
                ListEmptyComponent={
                  !loading ? (
                    <View className="px-6 mt-2">
                        {/* Determine current group type */}
                        {(() => {
                            const currentGroup = groups.find(g => g.id === selectedGroupId);
                            const isMindMap = currentGroup?.name === "Mapas Mentais";
                            const isFlashcard = currentGroup?.name === "Flashcards";

                            if (isMindMap) {
                                return (
                                    <EmptyState
                                        compact
                                        icon={<Brain size={40} color={isDark ? "#a1a1aa" : "#71717a"} />}
                                        title="Nenhum mapa mental"
                                        description="Comece a organizar suas ideias agora mesmo."
                                        action={
                                            <View className="gap-3 w-full mt-4 flex-col">
                                                <Button variant="ghost" className="w-full" onPress={() => router.push({ pathname: "/tools/mind-map", params: { groupId: currentGroup.id } })}>
                                                    <Button.Icon icon={Brain} size={18} /><Button.Text>Em branco</Button.Text>
                                                </Button>
                                                <Button variant="ghost" className="w-full" onPress={() => router.push({ pathname: "/tools/mind-map", params: { groupId: currentGroup.id, template: "brainstorming" } })}>
                                                    <Button.Icon icon={Lightbulb} size={18} /><Button.Text>Brainstorming</Button.Text>
                                                </Button>
                                            </View>
                                        }
                                    />
                                );
                            }
                            
                            if (isFlashcard) {
                                 return (
                                    <EmptyState
                                        compact
                                        icon={<Layers size={40} color={isDark ? "#a1a1aa" : "#71717a"} />}
                                        title="Nenhum Baralho"
                                        description="Crie seu primeiro deck de estudos para reter mais informações."
                                        action={
                                            <View className="gap-3 w-full mt-4 flex-col">
                                                <Button className="w-full" onPress={() => router.push({ pathname: "/tools/flashcards", params: { groupId: currentGroup.id } })}>
                                                    <Button.Icon icon={Plus} size={20} />
                                                    <Button.Text className="ml-2">Criar Novo Baralho</Button.Text>
                                                </Button>
                                            </View>
                                        }
                                    />
                                );
                            }

                            return (
                                <EmptyState
                                        compact
                                    icon={<FileText size={40} color={isDark ? "#a1a1aa" : "#71717a"} strokeWidth={1.5} />}
                                    title={searchQuery ? "Nenhuma nota encontrada" : "Suas ideias começam aqui"}
                                    description={searchQuery ? "Tente buscar por outro termo." : "Guarde uma ideia, organize seus planos ou crie um lembrete."}
                                    action={
                                        <View className="gap-3 w-full max-w-sm self-center">
                                            <Button className="w-full" onPress={() => router.push({ pathname: "/task/editor", params: { groupId: currentGroup?.id } })}>
                                                <Button.Icon icon={Plus} size={20} />
                                                <Button.Text className="ml-2">Criar nota</Button.Text>
                                            </Button>
                                            <Button variant="ghost" className="w-full"
                                                onPress={() => {
                                                    const tomorrow = new Date();
                                                    tomorrow.setDate(tomorrow.getDate() + 1);
                                                    router.push({ 
                                                        pathname: "/task/editor", 
                                                        params: { 
                                                            groupId: currentGroup?.id,
                                                            reminderDate: tomorrow.toISOString()
                                                        } 
                                                    });
                                                }}
                                            >
                                                <Button.Icon icon={Clock} size={20} />
                                                <Button.Text className="ml-2">Lembrar amanhã</Button.Text>
                                            </Button>
                                        </View>
                                    }
                                />
                            );
                        })()}
                    </View>
                  ) : null
                }
                renderItem={renderTask}
                extraData={selectedTaskIds}
                keyExtractor={taskKey}
                ItemSeparatorComponent={TaskSeparator}
                onScrollBeginDrag={closeSwipeRow}

            />
    </View>

      <BottomSheet
        sheetRef={bottomSheetModalRef}
        snapPoints={snapPoints}
      >
        <BottomSheet.View>
          <View className="flex-row items-center gap-4 mb-2">
            <View className="relative h-12 w-10 items-center justify-center">
              {/* Glassmorphic mini preview */}
              <BlurView 
                intensity={BLUR_CONFIG.miniatures.intensity}
                tint={isDark ? 'dark' : 'light'}
                // Removed blurTarget to avoid recursion crash on Android
                blurMethod={BLUR_CONFIG.miniatures.blurMethod}
                blurReductionFactor={BLUR_CONFIG.miniatures.blurReductionFactor}
                className="absolute h-10 w-8 rounded-lg rotate-[-10deg] translate-x-[-4px] opacity-40 overflow-hidden"
                style={{ backgroundColor: selectedLongPressGroup?.color ? `${selectedLongPressGroup.color}44` : '#6366f144' }}
              />
              <BlurView 
                intensity={BLUR_CONFIG.miniatures.intensity}
                tint={isDark ? 'dark' : 'light'}
                blurMethod={BLUR_CONFIG.miniatures.blurMethod}
                blurReductionFactor={BLUR_CONFIG.miniatures.blurReductionFactor}
                className="h-10 w-8 rounded-lg items-center justify-center z-10 border border-white/20 overflow-hidden"
                style={{ backgroundColor: selectedLongPressGroup?.color ? `${selectedLongPressGroup.color}cc` : '#6366f1cc' }}
              >
                <GroupIcon value={selectedLongPressGroup?.emoji} size={24} color={isDark ? "#fafafa" : "#18181b"} />
              </BlurView>
            </View>
            <Text className="font-sans-bold text-xl text-on-surface flex-1" numberOfLines={1}>
              {selectedLongPressGroup?.name}
            </Text>
          </View>
          
          <BottomSheet.ItemGroup>
            <BottomSheet.Item
              icon={<Edit3 size={20} color={resolvedTheme === 'dark' ? '#FFF' : '#000'} />}
              title="Editar Grupo"
              onPress={handleEditGroup}
            />
            <BottomSheet.Separator />
            <BottomSheet.Item
              icon={<Trash2 size={20} color="#ef4444" />}
              iconBackgroundColor="rgba(239, 68, 68, 0.1)"
              title="Excluir Grupo"
              onPress={handleDeleteGroup}
            />
          </BottomSheet.ItemGroup>
        </BottomSheet.View>
      </BottomSheet>

      {selectionMode && (
        <View className="absolute top-0 left-0 right-0 z-50 border-b border-border px-4 pb-2"
          style={{ paddingTop: insets.top + 4, backgroundColor: isDark ? '#121212' : '#ffffff' }}>
          <View className="flex-row items-center gap-2" style={{ minHeight: 48 }}>
            <TouchableOpacity onPress={exitSelection} disabled={deletingSelection} accessibilityRole="button" accessibilityLabel="Cancelar seleção" className="p-3">
              <X size={22} color={isDark ? '#fff' : '#18181b'} />
            </TouchableOpacity>
            <Text className="flex-1 font-sans-semibold text-base text-on-surface" accessibilityLiveRegion="polite">
              {selectedTaskIds.size} {selectedTaskIds.size === 1 ? 'selecionada' : 'selecionadas'}
            </Text>
            <TouchableOpacity onPress={selectAll} disabled={deletingSelection} accessibilityRole="button" accessibilityLabel={allSelected ? 'Desmarcar todas as notas' : 'Selecionar todas as notas da lista'} className="items-center justify-center px-2 py-1 gap-1" style={{ minHeight: 44 }}>
              <CheckCheck size={20} color={primaryColor} />
              <Text className="font-sans-semibold text-[10px]" style={{ color: primaryColor }}>{allSelected ? 'Desmarcar todas' : 'Selecionar tudo'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmDeleteSelection} disabled={selectedTaskIds.size === 0 || deletingSelection} accessibilityRole="button" accessibilityLabel="Excluir notas selecionadas" className="p-3" style={{ opacity: selectedTaskIds.size === 0 || deletingSelection ? 0.4 : 1 }}>
              <Trash2 size={22} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      )}
      <TabHeader
        hidden={selectionMode}
        scrollY={headerScrollY}
        title="Sua Biblioteca"
        backgroundThreshold={[0, 1]}
        secondaryTitle={selectedGroupId ? groups.find(g => g.id === selectedGroupId)?.name : "Recentes"}
        secondaryTitleThreshold={[380, 420]}
        stickyProgress={stickyChipsProgress}
          leftComponent={
            <Avatar 
                uri={profileImage}
                name={profileName}
                size="sm"
                onPress={() => router.push("/settings")}
            />
          }
          rightComponent={
            <>
              <Button variant="icon" className="rounded-full w-12 h-12" onPress={() => router.push("/search")}>
                <Button.Icon icon={<Search size={22} color={resolvedTheme === 'dark' ? '#FFF' : '#333'} />} />
              </Button>
              <Button variant="icon" className="rounded-full w-12 h-12" onPress={() => router.push("/search?mode=reminders")}>
                <Button.Icon icon={<Bell size={22} color={resolvedTheme === 'dark' ? '#FFF' : '#333'} />} />
              </Button>
            </>
          }
          bottomContent={
            <Animated.View style={stickyChipsStyle}>
              <GroupChipList
                groups={groups}
                selectedGroupId={selectedGroupId}
                onSelect={(id) => {
                  setSelectedGroupId(id);
                  const isScrolledDown = scrollY.value > 100;

                  // Calculate target X position for centering
                  let targetX = 0;
                  const layoutData = id === null ? groupCardLayouts.current['geral'] : groupCardLayouts.current[id.toString()];
                  
                  if (layoutData) {
                    const cardCenter = layoutData.x + (layoutData.width / 2);
                    // O Tailwind 'mr-5' (20px) fica fora do layout do card (à direita).
                    // Adicionamos metade da margem (10px) para que fique no centro VISUAL
                    targetX = cardCenter - (screenWidth / 2) + 10;
                  }

                  if (isScrolledDown) {
                    // Start vertical scroll
                    scrollViewRef.current?.scrollToOffset({ offset: 0, animated: true });
                    // Wait for vertical scroll to finish natively (~300ms) before horizontal scroll
                    // This prevents Android from dropping the horizontal scroll command
                    setTimeout(() => {
                      groupsScrollRef.current?.scrollTo?.({ 
                        x: Math.max(0, targetX), 
                        animated: true 
                      });
                    }, 400);
                  } else {
                    // Do it immediately if we're not scrolling vertically
                    groupsScrollRef.current?.scrollTo?.({ 
                      x: Math.max(0, targetX), 
                      animated: true 
                    });
                  }
                }}
              />
            </Animated.View>
          }
        />
    </View>
  );
}
