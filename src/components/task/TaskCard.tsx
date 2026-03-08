import { MediaPreview } from "@/components/task/MediaPreview";
import type { Media, Task } from "@/db/schema";
import { useTheme } from "@/providers/ThemeProvider";
import { shadows } from "@/theme/shadows";
import { withOpacity } from "@/utils/colors";
import { htmlToMarkdown, stripMarkdown, truncateText } from "@/utils/markdown";
import { AlertCircle, Bell, Calendar, Check, CheckCircle2, ChevronDown, Circle, Clock, Paperclip, Trash2 } from "lucide-react-native";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { EnrichedMarkdownText } from "react-native-enriched-markdown";

// Safely truncate markdown/HTML, ensuring open tags are closed
function truncateMarkdown(text: string, maxLength: number, maxLines: number = 5): { text: string; isTruncated: boolean } {
    if (!text) return { text, isTruncated: false };

    const lines = text.split('\n');
    let isTruncated = false;
    let truncated = text;

    if (lines.length > maxLines) {
        truncated = lines.slice(0, maxLines).join('\n');
        isTruncated = true;
    }

    if (truncated.length > maxLength) {
        truncated = truncated.substring(0, maxLength);
        isTruncated = true;
        
        // Simple truncation at maxLength, trying not to break inside a word
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > maxLength * 0.8) {
            truncated = truncated.substring(0, lastSpace);
        }
    }

    if (!isTruncated) {
        return { text, isTruncated: false };
    }

    // Strip out any trailing partial tag, e.g., `<span sty`
    const lastOpenIndex = truncated.lastIndexOf('<');
    const lastCloseIndex = truncated.lastIndexOf('>');
    if (lastOpenIndex > lastCloseIndex) {
        truncated = truncated.substring(0, lastOpenIndex);
    }

    // Best-effort tag balancing for basic HTML formatting
    const openTags: string[] = [];
    const tagRegex = /<\/?([a-z0-9]+)[^>]*>/gi;
    let match;
    
    while ((match = tagRegex.exec(truncated)) !== null) {
        const isClosing = match[0].startsWith('</');
        const tagName = match[1].toLowerCase();
        
        // Ignore self-closing tags
        if (['br', 'hr', 'img', 'input', 'meta'].includes(tagName)) continue;
        
        if (isClosing) {
            // Remove the last matching tag if it exists
            const lastIndex = openTags.lastIndexOf(tagName);
            if (lastIndex !== -1) {
                openTags.splice(lastIndex, 1);
            }
        } else {
            openTags.push(tagName);
        }
    }
    
    // Close the remaining open tags in reverse order
    for (let i = openTags.length - 1; i >= 0; i--) {
        truncated += `</${openTags[i]}>`;
    }
    
    return { text: truncated, isTruncated: true };
}

interface TaskCardProps {
  task: Task;
  mediaItems?: Media[];
  onPress: () => void;
  onDelete?: () => void;
  onMediaPress?: (media: Media) => void;
  onToggleComplete?: (task: Task) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (task: Task) => void;
}

export function TaskCard({ task, mediaItems = [], onPress, onDelete, onMediaPress, onToggleComplete, selectionMode, isSelected, onSelect }: TaskCardProps) {
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === "dark";
  const safeAccent = primaryColor || "#3B82F6";
  const snippet = truncateText(stripMarkdown(task.content ?? ""), 100);
  const thumbnailMedia = mediaItems.filter((m) => m.type === "image" || m.type === "latex" || m.type === "pdf");
  const hasMedia = mediaItems.length > 0;
  const isCompleted = task.completed === 1;

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
        activeOpacity={0.8}
        className="mb-3 rounded-[24px] p-5 border"
        style={{
          backgroundColor: isSelected ? withOpacity(primaryColor || "#3b82f6", 0.1) : (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"),
          borderColor: isSelected ? withOpacity(primaryColor || "#3b82f6", 0.3) : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"),
          opacity: (isCompleted && !selectionMode) ? 0.5 : 1,
        }}
      >
        <View className="flex-row items-center">
          {/* Completion or Selection checkbox */}
          {selectionMode ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={(e) => {
                e.stopPropagation();
                onSelect?.(task);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="mr-3"
            >
              <View 
                  className={`w-6 h-6 rounded-lg border-2 items-center justify-center`}
                  style={isSelected ? { backgroundColor: safeAccent, borderColor: safeAccent } : { borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" }}
              >
                  {isSelected && <Check size={16} color="#FFF" />}
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={(e) => {
                e.stopPropagation();
                onToggleComplete?.(task);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="mr-3"
            >
              {isCompleted ? (
                <CheckCircle2 size={24} color="#10B981" />
              ) : (
                <Circle size={24} color={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"} />
              )}
            </TouchableOpacity>
          )}

          <View className="h-12 w-12 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: withOpacity(reminderConfig.color, 0.12) }}>
            <Icon size={24} color={reminderConfig.color} />
          </View>
          <View className="flex-1 mr-2">
            <Text 
              className="text-base font-sans-bold" 
              style={{ color: isDark ? "#FAFAFA" : "#18181B", textDecorationLine: isCompleted ? 'line-through' : 'none' }} 
              numberOfLines={1}
            >
              {task.title || "Sem título"}
            </Text>
            <Text 
              className="mt-0.5 text-[13px] font-sans" 
              style={{ color: isDark ? "#A1A1AA" : "#71717A" }}
            >
              {task.deliveryDate ? new Date(`${task.deliveryDate}T${task.deliveryTime || "00:00:00"}`).toLocaleDateString("pt-BR", {
                weekday: 'short', day: "2-digit", month: "long"
              }).replace('.', '') : ''}
              {task.deliveryTime ? ` às ${task.deliveryTime.substring(0, 5)}` : ''}
            </Text>
          </View>
          <View className="items-end gap-2">
            <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: withOpacity(reminderConfig.color, 0.12) }}>
              <Text className="text-[11px] font-sans-bold" style={{ color: reminderConfig.color }}>
                {reminderConfig.label}
              </Text>
            </View>
            {onDelete && (
              <TouchableOpacity 
                  activeOpacity={0.8}
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
      activeOpacity={0.8}
      className="mb-3 rounded-2xl bg-surface-secondary p-4 border"
      style={[{
        backgroundColor: isSelected ? withOpacity(primaryColor || "#3b82f6", 0.08) : (isDark ? "#18181b" : "#f4f4f5"),
        borderColor: isSelected ? withOpacity(primaryColor || "#3b82f6", 0.3) : (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"),
        opacity: (isCompleted && !selectionMode) ? 0.5 : 1,
      }, shadows.sm]}
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

      <View className="flex-row items-start">
         {/* Completion or Selection checkbox */}
         {selectionMode ? (
           <TouchableOpacity
             activeOpacity={0.8}
             onPress={(e) => {
               e.stopPropagation();
               onSelect?.(task);
             }}
             hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
             className="mr-3 mt-0.5"
           >
              <View 
                  className={`w-5 h-5 rounded-md border-2 items-center justify-center`}
                  style={isSelected ? { backgroundColor: safeAccent, borderColor: safeAccent } : { borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" }}
              >
                  {isSelected && <CheckCircle2 size={14} color="#FFF" />}
              </View>
           </TouchableOpacity>
         ) : (
           <TouchableOpacity
             activeOpacity={0.8}
             onPress={(e) => {
               e.stopPropagation();
               onToggleComplete?.(task);
             }}
             hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
             className="mr-3 mt-0.5"
           >
             {isCompleted ? (
               <CheckCircle2 size={22} color="#10B981" />
             ) : (
               <Circle size={22} color={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"} />
             )}
           </TouchableOpacity>
         )}

         <View className="flex-1">
            {/* Title */}
            <Text
                className="font-sans-semibold text-base text-on-surface"
                numberOfLines={1}
                style={{ textDecorationLine: isCompleted ? 'line-through' : 'none' }}
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

                if (task.content) {
                    // task.content from the editor is HTML. We need to convert it to Markdown
                    // or strip it if no converter exists. Let's check `htmlToMarkdown`.
                    const markdownContent = htmlToMarkdown ? htmlToMarkdown(task.content) : stripMarkdown(task.content);
                    const { text: safeContent, isTruncated } = truncateMarkdown(markdownContent, 180);
                    
                    return (
                        <View className="mt-1 relative">
                            <View className="max-h-32 overflow-hidden pointer-events-none">
                                <EnrichedMarkdownText
                                    flavor="github"
                                    markdown={safeContent}
                                    allowTrailingMargin={false}
                                    markdownStyle={{
                                        paragraph: {
                                            color: isDark ? "rgb(212, 212, 216)" : "rgb(63, 63, 70)",
                                            fontSize: 14,
                                            marginTop: 0,
                                            marginBottom: 4,
                                        },
                                        h1: { fontSize: 15, fontWeight: "bold", color: isDark ? "rgb(244, 244, 245)" : "rgb(39, 39, 42)", marginTop: 2, marginBottom: 2 },
                                        h2: { fontSize: 15, fontWeight: "bold", color: isDark ? "rgb(244, 244, 245)" : "rgb(39, 39, 42)", marginTop: 2, marginBottom: 2 },
                                        h3: { fontSize: 14, fontWeight: "bold", color: isDark ? "rgb(228, 228, 231)" : "rgb(63, 63, 70)", marginTop: 2, marginBottom: 2 },
                                        h4: { fontSize: 14, fontWeight: "bold", color: isDark ? "rgb(228, 228, 231)" : "rgb(63, 63, 70)", marginTop: 2, marginBottom: 2 },
                                        h5: { fontSize: 14, fontWeight: "bold", color: isDark ? "rgb(228, 228, 231)" : "rgb(63, 63, 70)", marginTop: 2, marginBottom: 2 },
                                        h6: { fontSize: 14, fontWeight: "bold", color: isDark ? "rgb(228, 228, 231)" : "rgb(63, 63, 70)", marginTop: 2, marginBottom: 2 },
                                        strong: { fontWeight: "bold", color: isDark ? "rgb(244, 244, 245)" : "rgb(39, 39, 42)" },
                                        em: { fontStyle: "italic" },
                                        link: { color: isDark ? "#60A5FA" : "#3B82F6", underline: false },
                                        code: {
                                            fontFamily: "monospace",
                                            fontSize: 13,
                                            color: isDark ? "#F472B6" : "#DB2777",
                                            backgroundColor: isDark ? "rgba(244, 114, 182, 0.1)" : "rgba(219, 39, 119, 0.1)",
                                        },
                                        blockquote: {
                                            color: isDark ? "rgb(161, 161, 170)" : "rgb(113, 113, 122)",
                                            borderColor: safeAccent,
                                            borderWidth: 3,
                                            gapWidth: 12,
                                            backgroundColor: "transparent",
                                        },
                                        list: {
                                            color: isDark ? "rgb(212, 212, 216)" : "rgb(63, 63, 70)",
                                            fontSize: 14,
                                            marginTop: 0,
                                            marginBottom: 4,
                                            bulletColor: safeAccent,
                                            markerColor: isDark ? "rgb(161, 161, 170)" : "rgb(113, 113, 122)",
                                        },
                                        taskList: {
                                            checkedColor: safeAccent,
                                            borderColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
                                            checkboxSize: 16,
                                            checkboxBorderRadius: 4,
                                        },
                                        math: {
                                            color: isDark ? "rgb(212, 212, 216)" : "rgb(63, 63, 70)",
                                            fontSize: 14,
                                            marginTop: 2,
                                            marginBottom: 2,
                                        },
                                        inlineMath: {
                                            color: isDark ? "rgb(212, 212, 216)" : "rgb(63, 63, 70)",
                                        }
                                    }}
                                />
                            </View>
                            {isTruncated && (
                                // left: -34 perfectly offsets the CheckCircle2 width (22px) + mr-3 (12px) = 34px
                                // right: 0 aligns with the right edge of the text container.
                                <View className="absolute bottom-0 h-14 pointer-events-none justify-end items-center pb-0.5" style={{ left: -34, right: 0 }}>
                                    <ChevronDown size={18} color={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)"} />
                                </View>
                            )}
                        </View>
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
                activeOpacity={0.8}
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
