import { TaskCard } from "@/components/task/TaskCard";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { CardGradient } from "@/components/ui/CardGradient";
import { EmptyState } from "@/components/ui/EmptyState";
import { TabHeader } from "@/components/ui/TabHeader";
import { BLUR_CONFIG } from "@/config/blurConfig";
import type { Group, Media, Task } from "@/db/schema";
import { useDialog } from "@/providers/DialogProvider";
import { ScreenContext } from "@/providers/ScreenProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { getSetting } from "@/services/settingsService";
import { deleteGroup, deleteTask, getAllGroups, getAllTasks, getMediaForTask } from "@/services/taskService";
import { adjustColor, withOpacity } from "@/utils/colors";
import { getGreeting } from "@/utils/date";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { BlurView } from "expo-blur";
import { useFocusEffect, useRouter } from "expo-router";
import { Bell, Clock, Edit3, FolderPlus, Plus, Search, Trash2 } from "lucide-react-native";
import React, { useCallback, useContext, useEffect, useLayoutEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";


const GERAL_CARD_THEME = {
  colors: {
    primary: '#C491F1',  
    secondary: '#F4A261', 
    tertiary: '#50B0F9',
  }
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const dialog = useDialog();
  
  const [tasks, setTasks] = useState<Task[]>([]);
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
  const containerRef = React.useRef<View>(null);

  // Animation values for the "fan" effect
  const fanProgress = useSharedValue(0);
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
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

  const loadData = useCallback(async () => {
    try {
      const name = await getSetting("profile_name");
      const img = await getSetting("profile_image");
      setProfileName(name);
      setProfileImage(img);

      const [allTasks, allGroups] = await Promise.all([
        getAllTasks(),
        getAllGroups()
      ]);
      
      setTasks(allTasks);
      setGroups(allGroups);

      const mediaMap: Record<number, Media[]> = {};
      await Promise.all(
        allTasks.map(async (t) => {
          const m = await getMediaForTask(t.id);
          mediaMap[t.id] = m;
        })
      );
      setTaskMedia(mediaMap);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

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

  const handleDeleteTask = (task: Task) => {
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
                   loadData();
                }
            }
        ]
    });
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  const filteredTasks = tasks.filter(
    (t) => {
        const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.content?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesGroup = selectedGroupId === null || t.groupId === selectedGroupId;
        return matchesSearch && matchesGroup;
    }
  );

  const { screenRef, setScreenRef, isReady } = useContext(ScreenContext);

    // Ref for BlurTargetView - No longer needed for button, but keeping if cards need it later or removing if unused
    // The cards currently don't use blurTarget in the code I saw (commented out). 
    // If I remove BlurTargetView wrapper, standard BlurViews might behave differently on Android.
    // However, the new button doesn't need it. 
    // Let's remove the wrapper to simplify if it was only for the button.
    // But wait, the previous code wrapped the whole scrollview. 
    // I will remove the wrapper and the ref.

    useLayoutEffect(() => {
        if (containerRef.current) {
            setScreenRef(containerRef.current);
        }
    }, [setScreenRef]);

  return (
    <View className="flex-1 bg-surface">
      <View 
        ref={containerRef} 
        style={{ 
          flex: 1, 
          backgroundColor: isDark ? '#0a0a0a' : '#ffffff' 
        }}
      >
            <Animated.ScrollView 
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ 
                    paddingTop: insets.top + 80, 
                    paddingBottom: 150 
                }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
                }
            >
                <View className="px-6">
                    <Text className="font-sans text-on-surface-secondary text-base">{getGreeting(profileName)}</Text>
                    <Text className="font-sans-bold text-3xl text-on-surface mt-1">Sua Biblioteca</Text>
                </View>

                {/* Dynamic Groups Selection */}
                <View className="mt-4">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-6 overflow-visible">
                        {/* "All" Group Card */}
                        <TouchableOpacity 
                            activeOpacity={0.7}
                            onPress={() => setSelectedGroupId(null)}
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
                                        className="h-[140px] w-28 rounded-2xl shadow-xl border border-white/20 z-20 overflow-hidden" 
                                        style={[
                                            centerCardStyle,
                                            { backgroundColor: withOpacity(GERAL_CARD_THEME.colors.secondary, isDark ? 0.85 : 0.95) }
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
                                            activeOpacity={0.7}
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
                                activeOpacity={0.7}
                                onPress={() => setSelectedGroupId(group.id)}
                                onLongPress={() => handleLongPressGroup(group)}
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
                                            className="h-[140px] w-28 rounded-2xl shadow-xl border border-white/20 items-center justify-center z-20 overflow-hidden" 
                                            style={[
                                                centerCardStyle,
                                                { backgroundColor: group.color ? `${group.color}${isDark ? 'cc' : 'FF'}` : (isDark ? '#6366f1cc' : '#6366f1FF') }
                                            ]}
                                        >
                                            <BlurView 
                                                intensity={BLUR_CONFIG.cards.intensity} 
                                                tint={isDark ? 'dark' : 'light'}
                                                blurMethod={BLUR_CONFIG.cards.blurMethod}
                                                blurReductionFactor={BLUR_CONFIG.cards.blurReductionFactor}
                                                style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                <Text className="text-4xl">{group.emoji || '📁'}</Text>
                                            </BlurView>
                                        </Animated.View>
                                    </View>

                                    
                                    {/* Bottom Row: Text and FAB */}
                                    <View className="flex-row items-end justify-between w-full">
                                        <View className="flex-1 mr-2">
                                            <Text className="font-sans-bold text-xl text-on-surface" numberOfLines={1}>{group.name}</Text>
                                            <Text className="font-sans text-sm text-on-surface-secondary mt-1">
                                                {tasks.filter(t => t.groupId === group.id).length} Notas
                                            </Text>
                                        </View>
                                        
                                         {/* FAB Container (No Glow) */}
                                        <View className="items-center justify-center relative w-12 h-12">
                                            <TouchableOpacity 
                                                activeOpacity={0.7}
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
                            activeOpacity={0.7}
                            onPress={handleCreateGroup}
                            className="mr-10 h-72 w-56 rounded-[3rem] bg-surface-secondary border border-dashed border-border p-6 items-center justify-center"
                        >
                            <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: primaryColor + '15' }}>
                                <FolderPlus size={32} color={primaryColor} />
                            </View>
                            <Text className="mt-4 font-sans-bold text-base text-on-surface">Novo Grupo</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>

                {/* Section Header */}
                <View className="mt-4 px-6 flex-row items-center justify-between">
                    <View>
                        <Text className="font-sans-bold text-2xl text-on-surface">
                            {selectedGroupId ? groups.find(g => g.id === selectedGroupId)?.name : "Recentes"}
                        </Text>
                        <Text className="font-sans text-sm text-on-surface-secondary">{filteredTasks.length} Notas</Text>
                    </View>
                </View>

                {/* Task List Grid/List */}
                <View className="px-6 mt-6 gap-4">
                    {filteredTasks.length === 0 && !loading && (
                        <View>
                            {/* Determine current group type */}
                            {(() => {
                                const currentGroup = groups.find(g => g.id === selectedGroupId);
                                const isMindMap = currentGroup?.name === "Mapas Mentais";
                                const isFlashcard = currentGroup?.name === "Flashcards";

                                if (isMindMap) {
                                    return (
                                        <EmptyState
                                            icon={<View className="w-20 h-20 rounded-full items-center justify-center bg-purple-500/20"><Text className="text-4xl">🧠</Text></View>}
                                            title="Nenhum mapa mental"
                                            description="Comece a organizar suas ideias agora mesmo."
                                            action={
                                                <View className="gap-3 w-full mt-4 flex-row flex-wrap justify-center">
                                                    <Button variant="ghost" className="bg-surface-secondary border border-border shrink-0" onPress={() => router.push({ pathname: "/tools/mind-map", params: { groupId: currentGroup.id } })}>
                                                        <Button.Text>🧠 Em Branco</Button.Text>
                                                    </Button>
                                                    <Button variant="ghost" className="bg-surface-secondary border border-border shrink-0" onPress={() => router.push({ pathname: "/tools/mind-map", params: { groupId: currentGroup.id, template: "brainstorming" } })}>
                                                        <Button.Text>💡 Brainstorming</Button.Text>
                                                    </Button>
                                                </View>
                                            }
                                        />
                                    );
                                }
                                
                                if (isFlashcard) {
                                     return (
                                        <EmptyState
                                            icon={<View className="w-20 h-20 rounded-full items-center justify-center bg-blue-500/20"><Text className="text-4xl">🗂️</Text></View>}
                                            title="Nenhum Baralho"
                                            description="Crie seu primeiro deck de estudos para reter mais informações."
                                            action={
                                                <View className="mt-4">
                                                    <Button className="flex-row items-center w-full justify-center" onPress={() => router.push({ pathname: "/tools/flashcards", params: { groupId: currentGroup.id } })}>
                                                        <Plus size={20} color="#FFF" className="mr-2" />
                                                        <Button.Text>Criar Novo Baralho</Button.Text>
                                                    </Button>
                                                </View>
                                            }
                                        />
                                    );
                                }

                                return (
                                    <EmptyState
                                        icon={<View className="w-20 h-20 rounded-full items-center justify-center" style={{ backgroundColor: currentGroup?.color ? `${currentGroup.color}20` : primaryColor + '20' }}><Text className="text-4xl">{currentGroup?.emoji || '📝'}</Text></View>}
                                        title="Nenhuma nota encontrada"
                                        description="Crie sua primeira nota ou lembrete neste grupo."
                                        action={
                                            <View className="gap-3 w-full mt-4 flex-col">
                                                <Button className="flex-row items-center justify-center w-full" onPress={() => router.push({ pathname: "/task/editor", params: { groupId: currentGroup?.id } })}>
                                                    <Plus size={20} color="#FFF" className="mr-2" />
                                                    <Button.Text>Nova Nota Vazia</Button.Text>
                                                </Button>
                                                <Button variant="ghost" className="bg-surface-secondary border border-border flex-row items-center justify-center w-full" 
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
                                                    <Clock size={18} color={primaryColor} className="mr-2" />
                                                    <Button.Text>📅 Lembrete para Amanhã</Button.Text>
                                                </Button>
                                            </View>
                                        }
                                    />
                                );
                            })()}
                        </View>
                    )}
                    {filteredTasks.map((item) => {
                        const taskGroup = groups.find(g => g.id === item.groupId);
                        const isMindMap = taskGroup?.name === "Mapas Mentais";
                        const isFlashcard = taskGroup?.name === "Flashcards";

                        return (
                            <TaskCard
                                key={item.id}
                                task={item}
                                mediaItems={taskMedia[item.id]}
                                onPress={() => {
                                    if (isMindMap) {
                                        router.push({ pathname: "/tools/mind-map", params: { taskId: item.id } });
                                    } else if (isFlashcard) {
                                        router.push({ pathname: "/tools/flashcards", params: { taskId: item.id } });
                                    } else {
                                        router.push(`/task/${item.id}`);
                                    }
                                }}
                                onDelete={() => handleDeleteTask(item)}
                            onMediaPress={(media) => {
                                if (media.type === 'image' || media.type === 'latex' || media.type === 'pdf') {
                                    const mediaItems = taskMedia[item.id] || [];
                                    const index = mediaItems.indexOf(media);
                                    router.push({
                                        pathname: "/media-preview",
                                        params: { 
                                            uri: media.uri, 
                                            type: media.type,
                                            thumbnailUri: media.thumbnailUri || (media as any).thumbnail_uri,
                                            mediaItems: JSON.stringify(mediaItems.map(m => ({ 
                                                uri: m.uri, 
                                                type: m.type,
                                            thumbnailUri: m.thumbnailUri || (m as any).thumbnail_uri
                                        }))),
                                        index: index >= 0 ? index.toString() : "0"
                                    }
                                });
                            }
                        }}
                    />
                    );
                })}
                </View>
            </Animated.ScrollView>
    </View>

      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: resolvedTheme === 'dark' ? '#18181b' : '#f4f4f5' }}
        handleIndicatorStyle={{ backgroundColor: resolvedTheme === 'dark' ? '#52525b' : '#d4d4d8' }}
      >
        <BottomSheetView 
          className="p-6 gap-4"
          style={{ paddingBottom: insets.bottom + 24 }}
        >
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
                <Text className="text-xl">{selectedLongPressGroup?.emoji || '📁'}</Text>
              </BlurView>
            </View>
            <Text className="font-sans-bold text-xl text-on-surface flex-1" numberOfLines={1}>
              {selectedLongPressGroup?.name}
            </Text>
          </View>
          
          <Button 
            variant="ghost"
            onPress={handleEditGroup}
            className="flex-row items-center p-4 bg-surface-secondary rounded-2xl border border-border"
          >
            <Button.Icon icon={<Edit3 size={20} color={resolvedTheme === 'dark' ? '#FFF' : '#000'} />} />
            <Button.Text className="ml-4">Editar Grupo</Button.Text>
          </Button>
          
          <Button 
            variant="ghost"
            onPress={handleDeleteGroup}
            className="flex-row items-center p-4 bg-red-500/10 rounded-2xl border border-red-500/20"
          >
            <Button.Icon icon={<Trash2 size={20} color="#ef4444" />} />
            <Button.Text style={{ color: '#ef4444' }} className="ml-4">Excluir Grupo</Button.Text>
          </Button>
        </BottomSheetView>
      </BottomSheetModal>

      {isReady && (
        <TabHeader
          scrollY={scrollY}
          title="Sua Biblioteca"
          titleThreshold={[50, 70]}
          secondaryTitle={selectedGroupId ? groups.find(g => g.id === selectedGroupId)?.name : "Recentes"}
          secondaryTitleThreshold={[420, 480]}
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
        />
      )}
    </View>
  );
}
