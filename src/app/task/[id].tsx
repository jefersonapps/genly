import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Edit, Trash2 } from "lucide-react-native";
import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MediaPreview } from "@/components/task/MediaPreview";
import { Button } from "@/components/ui/Button";
import { RichTextRenderer } from "@/components/ui/RichTextRenderer";
import type { Media, Task } from "@/db/schema";
import { useDialog } from "@/providers/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { deleteTask, getMediaForTask, getTaskById, updateTask } from "@/services/taskService";
import { getEditorStyles } from "@/utils/editorStyles";

// ─── Helpers ─────────────────────────────────────
function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16) || 0,
    g: parseInt(h.substring(2, 4), 16) || 0,
    b: parseInt(h.substring(4, 6), 16) || 0,
  };
}

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastSafeColor(color: string, isDark: boolean): string {
  const bgLum = isDark ? 0.03 : 0.95;
  const colorLum = luminance(color);
  const ratio =
    (Math.max(colorLum, bgLum) + 0.05) /
    (Math.min(colorLum, bgLum) + 0.05);
  if (ratio >= 3) return color;
  const { r, g, b } = hexToRgb(color);
  if (isDark) {
    const t = 0.55;
    const nr = Math.round(r + (255 - r) * t);
    const ng = Math.round(g + (255 - g) * t);
    const nb = Math.round(b + (255 - b) * t);
    return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
  }
  const t = 0.45;
  const nr = Math.round(r * (1 - t));
  const ng = Math.round(g * (1 - t));
  const nb = Math.round(b * (1 - t));
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

export default function TaskDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const { primaryColor, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const safeAccent = getContrastSafeColor(primaryColor, isDark);

  const [task, setTask] = useState<Task | null>(null);
  const [mediaItems, setMediaItems] = useState<Media[]>([]);
  const [focusKey, setFocusKey] = useState(0);

  // Derived colors for styles
  const colors = {
      text: isDark ? "#FAFAFA" : "#18181B",
      textSecondary: isDark ? "#A1A1AA" : "#71717A",
      surfaceTertiary: isDark ? "#262626" : "#E4E4E7",
      placeholder: isDark ? "#52525B" : "#A1A1AA",
      // UI neutral colors
      iconNeutral: isDark ? "#D4D4D8" : "#52525B",
  };

  const editorStyles = React.useMemo(() => getEditorStyles({
      text: colors.text,
      textSecondary: colors.textSecondary,
      surfaceTertiary: colors.surfaceTertiary,
      safeAccent: safeAccent,
      placeholder: colors.placeholder,
      isDark,
  }), [colors, safeAccent, isDark]);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      const load = async () => {
        if (!id) return;
        const taskId = parseInt(id);
        const t = await getTaskById(taskId);
        if (isActive && t) {
          setTask(t);
          const m = await getMediaForTask(taskId);
          if (isActive) {
             setMediaItems(m);
             setFocusKey(Date.now());
          }
        }
      };

      load();

      return () => {
        isActive = false;
      };
    }, [id])
  );

  const handleDelete = async () => {
     if (!task) return;
     dialog.show({
        title: "Excluir Tarefa",
        description: "Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.",
        buttons: [
            {
                text: "Cancelar",
                variant: "ghost",
                onPress: dialog.hide,
            },
            {
                text: "Excluir",
                variant: "destructive",
                onPress: async () => {
                    await deleteTask(task.id);
                    dialog.hide();
                    router.back();
                },
            },
        ],
     });
  };

  const openMedia = (media: Media) => {
     if (media.type === 'image' || media.type === 'latex' || media.type === 'pdf') {
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
  };

  const handleToggleCheckbox = async (checkboxIndex: number, isChecked: boolean) => {
      if (!task || !task.content) return;

      // We need to parse the content and find the N-th <li> inside <ul data-type="checkbox">
      // A safe way is to split by `ul data-type="checkbox"` blocks.
      let currentIdx = 0;
      let newContent = task.content;

      // This regex matches an entire <ul data-type="checkbox">...</ul> block (non-greedy)
      const ulRegex = /<ul\s+data-type="checkbox">([\s\S]*?)<\/ul>/gi;
      
      newContent = newContent.replace(ulRegex, (match, innerLis) => {
          // Inside this UL block, match each <li> tag
          const liRegex = /<li(\s+checked)?>/gi;
          const newInnerLis = innerLis.replace(liRegex, (liMatch: string) => {
              if (currentIdx === checkboxIndex) {
                  currentIdx++;
                  return isChecked ? '<li checked>' : '<li>';
              }
              currentIdx++;
              return liMatch;
          });
          return `<ul data-type="checkbox">${newInnerLis}</ul>`;
      });

      // Optimistically update the UI is NOT needed for the WebView because the 
      // injected JS already toggled the DOM element visually.
      // If we update `task` state here, it will trigger a full WebView reload (flash).
      // setTask({ ...task, content: newContent });

      // Persist to DB directly
      try {
          await updateTask(task.id, { ...task, content: newContent });
          // Optionally, we can update the task state *without* triggering a re-render 
          // of the WebView, but React state updates will always re-render.
          // Since the WebView only uses `task.content` for its initial `source`, 
          // we should manage that inside `RichTextRenderer` to ignore identical content changes, 
          // or just leave the state alone and let the DB hold the new truth.
          // To keep the state in sync in case they press Edit:
          setTask(prev => prev ? { ...prev, content: newContent } : prev);
      } catch (err) {
          console.error("Failed to update task checkbox:", err);
      }
  };

  if (!task) return <View className="flex-1 bg-surface" />;



  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <View className="flex-row items-center flex-1">
          <Button variant="icon" onPress={() => router.back()}>
            <Button.Icon icon={<ArrowLeft size={24} color={colors.text} />} />
          </Button>
          <Text className="font-sans-bold text-lg text-on-surface ml-4">Nota</Text>
        </View>
        <View className="flex-row gap-2">
            <Button
                variant="icon"
                onPress={() => router.push({ pathname: "/task/editor", params: { id: task.id } })}
            >
                <Button.Icon icon={<Edit size={22} color={colors.iconNeutral} />} />
            </Button>
             <Button variant="icon" onPress={handleDelete}>
                <Button.Icon icon={<Trash2 size={22} color={colors.iconNeutral} />} />
            </Button>
        </View>
      </View>

      {/* Content - fills available space */}
      <View style={{ flex: 1, paddingHorizontal: 20 }}>
          {task.title ? (
            <Text className="font-sans-bold text-2xl text-on-surface mt-6 mb-4">
              {task.title}
            </Text>
          ) : null}
          <RichTextRenderer 
              content={task.content || ""} 
              colors={{
                  text: colors.text,
                  textSecondary: colors.textSecondary,
                  surfaceTertiary: colors.surfaceTertiary,
                  safeAccent: safeAccent,
                  isDark: isDark,
              }}
              scrollEnabled={true}
              onToggleCheckbox={handleToggleCheckbox}
              updateKey={focusKey}
          />
      </View>

      {/* Media List - fixed at bottom */}
      {mediaItems.length > 0 && (
          <View style={{ paddingTop: 12, paddingBottom: insets.bottom + 20 }}>
              <Text style={{ paddingHorizontal: 20 }} className="font-sans-bold text-lg text-on-surface mb-3">Anexos</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              >
                  {mediaItems.map((m) => (
                      <TouchableOpacity 
                          key={m.id} 
                          onPress={() => openMedia(m)}
                          className="rounded-xl overflow-hidden"
                          style={{ width: 120, height: 120, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }}
                      >
                          <MediaPreview media={m as any} size={120} gridSize={16} />
                      </TouchableOpacity>
                  ))}
              </ScrollView>
          </View>
      )}
    </View>
  );
}
