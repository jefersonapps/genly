import { MediaPreview } from "@/components/task/MediaPreview";
import { MathJaxRenderer } from "@/components/ui/MathJaxRenderer";
import type { Media, Task } from "@/db/schema";
import { useTheme } from "@/providers/ThemeProvider";
import { withOpacity } from "@/utils/colors";
import { stripMarkdown, truncateText } from "@/utils/markdown";
import { AlertCircle, Bell, Calendar, Clock, Paperclip, Trash2 } from "lucide-react-native";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

interface TaskCardProps {
  task: Task;
  mediaItems?: Media[];
  onPress: () => void;
  onDelete?: () => void;
  onMediaPress?: (media: Media) => void;
}

export function TaskCard({ task, mediaItems = [], onPress, onDelete, onMediaPress }: TaskCardProps) {
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === "dark";
  const snippet = truncateText(stripMarkdown(task.content ?? ""), 100);
  const thumbnailMedia = mediaItems.filter((m) => m.type === "image" || m.type === "latex" || m.type === "pdf");
  const hasMedia = mediaItems.length > 0;

  const formattedDate = new Date(task.updatedAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });

  const getReminderConfig = () => {
    if (!task.deliveryDate) return null;
    
    const now = new Date();
    const target = new Date(`${task.deliveryDate}T${task.deliveryTime || "00:00:00"}`);
    
    // Reset times to compare just dates for "today" and "tomorrow"
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const targetDate = new Date(target.getFullYear(), target.getMonth(), target.getDate());

    if (target.getTime() < now.getTime()) {
      return { label: "Expirado", color: "#EF4444", icon: AlertCircle };
    } else if (targetDate.getTime() === today.getTime()) {
      return { label: "Hoje", color: primaryColor, icon: Bell };
    } else if (targetDate.getTime() === tomorrow.getTime()) {
      return { label: "Amanhã", color: "#F59E0B", icon: Clock };
    } else {
      const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        return { label: `Em ${diffDays} dias`, color: "#3B82F6", icon: Calendar };
      } else {
        return { 
          label: target.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }), 
          color: "#10B981", 
          icon: Calendar 
        };
      }
    }
  };

  const reminderConfig = getReminderConfig();

  if (reminderConfig) {
    const Icon = reminderConfig.icon;
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        className="mb-3 rounded-[24px] p-5"
        style={{
          backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
          borderWidth: 1,
          borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
        }}
      >
        <View className="flex-row items-center">
          <View className="h-12 w-12 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: withOpacity(reminderConfig.color, 0.12) }}>
            <Icon size={24} color={reminderConfig.color} />
          </View>
          <View className="flex-1 mr-2">
            <Text style={{ fontFamily: "Montserrat-Bold", fontSize: 16, color: isDark ? "#FAFAFA" : "#18181B" }} numberOfLines={1}>
              {task.title || "Sem título"}
            </Text>
            <Text style={{ fontFamily: "Montserrat-Regular", fontSize: 13, color: isDark ? "#A1A1AA" : "#71717A" }} className="mt-0.5">
              {task.deliveryDate ? new Date(`${task.deliveryDate}T${task.deliveryTime || "00:00:00"}`).toLocaleDateString("pt-BR", {
                weekday: 'short', day: "2-digit", month: "long"
              }).replace('.', '') : ''}
              {task.deliveryTime ? ` às ${task.deliveryTime.substring(0, 5)}` : ''}
            </Text>
          </View>
          <View className="items-end gap-2">
            <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: withOpacity(reminderConfig.color, 0.12) }}>
              <Text style={{ fontFamily: "Montserrat-Bold", fontSize: 11, color: reminderConfig.color }}>
                {reminderConfig.label}
              </Text>
            </View>
            {onDelete && (
              <TouchableOpacity 
                  onPress={(e) => {
                      e.stopPropagation();
                      onDelete();
                  }}
                  className="p-1 -mr-1 opacity-50 active:opacity-100"
              >
                  <Trash2 size={16} color={isDark ? "rgb(163,163,163)" : "#737373"} /> 
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {/* Render snippets conditionally below if they exist */}
        {snippet ? (
           <Text className="mt-4 font-sans text-sm text-on-surface-secondary" numberOfLines={2}>
              {snippet}
           </Text>
        ) : null}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="mb-3 rounded-2xl bg-surface-secondary p-4"
      style={{
        borderWidth: 1,
        borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 2, // Slightly reduced vertical offset for cards compared to floating tab bar
        },
        shadowOpacity: 0.1, // Reduced opacity for a cleaner look on lists
        shadowRadius: 3,
        elevation: 3,
      }}
    >
      {/* Media thumbnails scroll row */}
      {thumbnailMedia.length > 0 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            className="mb-3"
            contentContainerStyle={{ gap: 8 }}
          >
          {thumbnailMedia.map((m) => (
              <TouchableOpacity 
                key={m.id} 
                activeOpacity={0.8}
                onPress={(e) => {
                    e.stopPropagation();
                    if (onMediaPress) onMediaPress(m);
                }}
              >
                <MediaPreview media={m as any} size={68} gridSize={10} rounded={12} />
              </TouchableOpacity>
          ))}
          </ScrollView>
      )}

      <View className="flex-row justify-between items-start">
         <View className="flex-1">
            {/* Title */}
            <Text
                className="font-sans-semibold text-base text-on-surface"
                numberOfLines={1}
            >
                {task.title}
            </Text>

             {/* Content snippet */}
            {(() => {
                if (!task.content) return null;

                // Try to detect specialized content
                try {
                    const parsed = JSON.parse(task.content);
                    
                    // Mind Map detection
                    if (parsed && typeof parsed === 'object' && 'nodes' in parsed) {
                        return (
                            <View className="mt-2 flex-row items-center self-start px-3 py-1.5 rounded-full"
                                style={{ 
                                    backgroundColor: isDark ? 'rgba(168, 85, 247, 0.15)' : 'rgba(168, 85, 247, 0.1)',
                                    borderWidth: 1,
                                    borderColor: isDark ? 'rgba(168, 85, 247, 0.3)' : 'rgba(168, 85, 247, 0.2)'
                                }}
                            >
                                <Text className="text-xs mr-2">🧠</Text>
                                <Text className="font-sans-bold text-[10px] uppercase tracking-wider" style={{ color: "#A855F7" }}>
                                    Mapa Mental
                                </Text>
                            </View>
                        );
                    }

                    // Flashcard detection
                    if (Array.isArray(parsed) && parsed.length > 0 && 'front' in parsed[0]) {
                        return (
                            <View className="mt-3 p-3 rounded-2xl bg-surface border border-outline/5"
                                style={{
                                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.03)',
                                    borderColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)'
                                }}
                            >
                                <View className="flex-row items-center mb-1.5">
                                    <View className="w-1.5 h-1.5 rounded-full mr-2" style={{ backgroundColor: '#3B82F6' }} />
                                    <Text className="font-sans-bold text-[#3B82F6] text-[10px] uppercase tracking-wider">Primeiro Cartão</Text>
                                </View>
                                <Text className="font-sans text-on-surface text-sm leading-relaxed" numberOfLines={2}>
                                    {parsed[0].front}
                                </Text>
                            </View>
                        );
                    }
                } catch {
                    // Not JSON, continue to standard renderers
                }

                if (task.content?.match(/(\$|\\\(|\\\[)/)) {
                    return (
                        <View className="mt-1 h-20 overflow-hidden pointer-events-none">
                            <MathJaxRenderer content={task.content} color={isDark ? "rgb(212, 212, 216)" : "rgb(63, 63, 70)"} />
                        </View>
                    );
                }

                if (snippet) {
                    return (
                        <Text
                            className="mt-1 font-sans text-sm text-on-surface-secondary"
                            numberOfLines={2}
                        >
                            {snippet}
                        </Text>
                    );
                }

                return null;
            })()}
         </View>
      </View>

      {/* Footer: date & attachment indicator */}
      <View className="mt-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
            <Clock size={12} color="rgb(163,163,163)" />
            <Text className="ml-1 font-sans text-xs text-muted">{formattedDate}</Text>
            
            {task.deliveryDate && task.deliveryTime && (
              <View className="ml-3 flex-row items-center bg-primary/10 px-2 py-0.5 rounded-full">
                <Bell size={10} color={primaryColor} />
                <Text className="ml-1 font-sans-semibold text-[10px]" style={{ color: primaryColor }}>
                  {new Date(`${task.deliveryDate}T${task.deliveryTime}`).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            )}
            {hasMedia && (
            <View className="ml-3 flex-row items-center">
                <Paperclip size={12} color="rgb(163,163,163)" />
                <Text className="ml-1 font-sans text-xs text-muted">
                {mediaItems.length}
                </Text>
            </View>
            )}
        </View>

        {onDelete && (
            <TouchableOpacity 
                onPress={(e) => {
                    e.stopPropagation();
                    onDelete();
                }}
                className="p-1 -mr-1 opacity-50 active:opacity-100"
            >
                 <Trash2 size={18} color={isDark ? "#A3A3A3" : "#737373"} /> 
            </TouchableOpacity>
         )}
      </View>
    </TouchableOpacity>
  );
}
