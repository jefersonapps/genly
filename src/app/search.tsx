import { TaskCard } from "@/components/task/TaskCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { KeyboardAvoidingView } from "@/components/ui/KeyboardAvoidingView";
import type { Group, Media, Task } from "@/db/schema";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useTheme } from "@/providers/ThemeProvider";
import { getAllGroups, getAllTasks, getMediaForTask } from "@/services/taskService";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Bell, Search as SearchIcon, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: "reminders" }>();
  const isRemindersMode = mode === "reminders";
  
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [searchQuery, setSearchQuery] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [taskMedia, setTaskMedia] = useState<Record<number, Media[]>>({});
  const [loading, setLoading] = useState(true);
  
  const inputRef = useRef<TextInput>(null);

  const { isVisible: isKeyboardVisible } = useKeyboard();
  const [flexToggle, setFlexToggle] = useState(true);

  useEffect(() => {
    setFlexToggle(!isKeyboardVisible);
  }, [isKeyboardVisible]);

  useEffect(() => {
    loadData();
    // Auto-focus the input after a short delay to ensure transition is done
    const timeout = setTimeout(() => {
        inputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  const loadData = async () => {
    try {
      const [allTasks, allGroups] = await Promise.all([
        getAllTasks(),
        getAllGroups()
      ]);
      
      setGroups(allGroups);

      let finalTasks = allTasks;

      if (isRemindersMode) {
        // Filter tasks with reminders
        finalTasks = allTasks.filter(t => t.deliveryDate && t.deliveryTime);

        // Sort by proximity (closest to now first)
        finalTasks.sort((a, b) => {
          const dateA = new Date(`${a.deliveryDate}T${a.deliveryTime}`);
          const dateB = new Date(`${b.deliveryDate}T${b.deliveryTime}`);
          return dateA.getTime() - dateB.getTime();
        });
      }

      setTasks(finalTasks);

      const mediaMap: Record<number, Media[]> = {};
      await Promise.all(
        finalTasks.map(async (t) => {
          const m = await getMediaForTask(t.id);
          mediaMap[t.id] = m;
        })
      );
      setTaskMedia(mediaMap);
    } catch (e) {
      console.error("Failed to load tasks", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (!searchQuery.trim()) return true; // Show all if query is empty
    const q = searchQuery.toLowerCase();
    return (
      (t.title?.toLowerCase().includes(q) || false) ||
      (t.content?.toLowerCase().includes(q) || false)
    );
  });

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
      <KeyboardAvoidingView 
        behavior="padding"
        keyboardVerticalOffset={20}
        className="flex-1"
        style={[
            flexToggle ? { flexGrow: 1 } : { flex: 1 }
        ]}
      >
        {/* Header */}
        <View className="px-4 py-2 flex-row items-center gap-3 border-b border-border">
          <Button variant="icon" onPress={() => router.back()} className="rounded-full w-10 h-10">
              <Button.Icon icon={<ArrowLeft size={24} color={isDark ? "#FFF" : "#000"} />} />
          </Button>
          
          <View 
              className="flex-1 flex-row items-center h-12 bg-surface-secondary rounded-2xl px-4"
              style={{ 
                  borderWidth: 1, 
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" 
              }}
          >
              <SearchIcon size={20} color={isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"} />
              <TextInput
                  ref={inputRef}
                  className="flex-1 ml-3 font-sans text-base text-on-surface"
                  placeholder={isRemindersMode ? "Buscar lembretes..." : "Buscar notas..."}
                  placeholderTextColor={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                  <Button 
                      variant="icon" 
                      onPress={() => {
                          setSearchQuery("");
                          inputRef.current?.focus();
                      }}
                      className="w-8 h-8 rounded-full bg-border"
                  >
                      <Button.Icon icon={<X size={14} color={isDark ? "#FFF" : "#000"} />} />
                  </Button>
              )}
          </View>
        </View>

        {/* Results */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : (
          <FlashList<Task>
              data={filteredTasks}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                  const taskGroup = groups.find(g => g.id === item.groupId);
                  const isMindMap = taskGroup?.name === "Mapas Mentais";
                  const isFlashcard = taskGroup?.name === "Flashcards";

                  return (
                      <TaskCard
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
                      />
                  );
              }}
              ListEmptyComponent={
                  searchQuery.trim().length > 0 ? (
                      <EmptyState
                          icon={<SearchIcon size={48} color="gray" />}
                          title="Nenhum resultado"
                          description={`Não encontramos nada para "${searchQuery}"`}
                      />
                  ) : (
                      isRemindersMode ? (
                        <View className="mt-20">
                            <EmptyState
                                icon={<Bell size={48} color={primaryColor} opacity={0.5} />}
                                title="Nenhum lembrete"
                                description="Você não tem nenhuma nota com lembrete definido no momento."
                            />
                        </View>
                      ) : (
                        <View className="items-center justify-center pt-20 opacity-50">
                            <SearchIcon size={64} color={isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"} />
                            <ActivityIndicator style={{ opacity: 0 }} /* Spacer */ />
                            <Text className="font-sans text-on-surface-secondary text-lg text-center mt-4 px-10">
                                Digite para pesquisar em suas notas
                            </Text>
                        </View>
                      )
                  )
              }
          />
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
