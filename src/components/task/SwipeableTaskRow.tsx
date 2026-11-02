import { TaskCard } from '@/components/task/TaskCard';
import type { Media, Task } from '@/db/schema';
import { useTheme } from '@/providers/ThemeProvider';
import { useRouter } from 'expo-router';
import { Check, Pencil, Trash2 } from 'lucide-react-native';
import React, { memo, useCallback, useLayoutEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NoteSwipeable, type NoteSwipeableMethods } from './NoteSwipeable';
import { withOpacity } from '@/utils/colors';

export type TaskRowKind = 'note' | 'mind-map' | 'flashcards';
interface Props {
  task: Task;
  kind: TaskRowKind;
  mediaItems?: Media[];
  activeRow: React.RefObject<NoteSwipeableMethods | null>;
  onDelete: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onStartSelection?: (task: Task) => void;
  onSelect?: (task: Task) => void;
}

export const SwipeableTaskRow = memo(function SwipeableTaskRow({ task, kind, mediaItems, activeRow, onDelete, onToggleComplete, selectionMode = false, selected = false, onStartSelection, onSelect }: Props) {
  const router = useRouter();
  const { primaryColor, resolvedTheme } = useTheme();
  const swipeRef = useRef<NoteSwipeableMethods>(null);
  const isDark = resolvedTheme === "dark";
  const deleteColor = isDark ? "#f87171" : "#dc2626";

  // FlashList reuses this view for other notes. Never carry an open swipe over.
  useLayoutEffect(() => {
    swipeRef.current?.reset();
    const row = swipeRef.current;
    return () => {
      if (activeRow.current === row) activeRow.current = null;
    };
  }, [task.id, activeRow]);

  const close = useCallback(() => swipeRef.current?.close(), []);
  const openNote = useCallback(() => {
    close();
    if (kind === 'mind-map') router.push({ pathname: '/tools/mind-map', params: { taskId: task.id } });
    else if (kind === 'flashcards') router.push({ pathname: '/tools/flashcards', params: { taskId: task.id } });
    else router.push(`/task/${task.id}`);
  }, [close, kind, router, task.id]);
  const edit = useCallback(() => {
    close();
    if (kind === 'note') router.push({ pathname: '/task/editor', params: { id: task.id } });
    else openNote();
  }, [close, kind, router, task.id, openNote]);
  const remove = useCallback(() => { close(); onDelete(task); }, [close, onDelete, task]);
  const mediaPress = useCallback((media: Media) => {
    close();
    const items = mediaItems || [];
    router.push({ pathname: '/media-preview', params: {
      uri: media.uri, type: media.type, thumbnailUri: media.thumbnailUri || undefined,
      mediaItems: JSON.stringify(items.map(item => ({ uri: item.uri, type: item.type, thumbnailUri: item.thumbnailUri }))),
      index: String(Math.max(0, items.indexOf(media))),
    } });
  }, [close, mediaItems, router]);
  const willOpen = useCallback(() => {
    if (activeRow.current !== swipeRef.current) activeRow.current?.close();
    activeRow.current = swipeRef.current;
  }, [activeRow]);
  const startSelection = useCallback(() => { close(); onStartSelection?.(task); }, [close, onStartSelection, task]);
  const select = useCallback(() => onSelect?.(task), [onSelect, task]);
  const actions = (
    <View style={styles.actionRail}>
      <TouchableOpacity onPress={edit} activeOpacity={0.65} accessibilityRole="button" accessibilityLabel="Editar nota" style={styles.action}>
        <View style={[styles.actionIcon, { backgroundColor: withOpacity(primaryColor, isDark ? 0.12 : 0.08) }]}>
          <Pencil size={20} strokeWidth={1.8} color={primaryColor} />
        </View>
        <Text style={[styles.actionLabel, { color: isDark ? '#d4d4d8' : '#52525b' }]}>Editar</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={remove} activeOpacity={0.65} accessibilityRole="button" accessibilityLabel="Apagar nota" style={styles.action}>
        <View style={[styles.actionIcon, { backgroundColor: withOpacity(deleteColor, isDark ? 0.1 : 0.06) }]}>
          <Trash2 size={20} strokeWidth={1.8} color={deleteColor} />
        </View>
        <Text style={[styles.actionLabel, { color: deleteColor }]}>Apagar</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={select}
        disabled={!selectionMode}
        accessible={selectionMode}
        accessibilityRole={selectionMode ? "checkbox" : undefined}
        accessibilityState={selectionMode ? { checked: selected } : undefined}
        accessibilityLabel={selectionMode ? `Selecionar ${task.title}` : undefined}
        activeOpacity={0.8}
        style={styles.selectionRow}
      >
        <View style={{ width: selectionMode ? 36 : 0, overflow: 'hidden' }}
          pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <View style={[styles.checkbox, {
            borderColor: selected ? primaryColor : isDark ? '#71717a' : '#a1a1aa',
            backgroundColor: selected ? primaryColor : 'transparent',
          }]}>
            {selected && <Check size={16} color="#fff" />}
          </View>
        </View>
        <View pointerEvents={selectionMode ? "none" : "auto"}
          importantForAccessibility={selectionMode ? "no-hide-descendants" : "auto"}
          accessibilityElementsHidden={selectionMode} style={styles.card}>
          <NoteSwipeable ref={swipeRef} enabled={!selectionMode} actions={actions} onSwipeStart={willOpen} backgroundColor={isDark ? '#18181b' : '#f4f4f5'}>
            <TaskCard compact task={task} mediaItems={mediaItems} onPress={openNote}
              onLongPress={startSelection} onMediaPress={mediaPress} onToggleComplete={onToggleComplete}
              selectionMode={selectionMode} hideStatusControl={selectionMode} externalBorder isSelected={selected} />
          </NoteSwipeable>
          <View pointerEvents="none" style={[styles.cardOutline, {
            borderColor: selectionMode && selected ? withOpacity(primaryColor, 0.6) : isDark ? '#303034' : '#e4e4e7',
            borderWidth: selectionMode && selected ? 1.5 : 1,
            opacity: task.completed === 1 && !selected ? 0.5 : 1,
          }]} />
        </View>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { paddingHorizontal: 24 },
  selectionRow: { flexDirection: 'row', alignItems: 'center' },
  card: { flex: 1, position: 'relative', overflow: 'visible' },
  // A sibling of the swipe mask: the rounded stroke cannot be clipped by it.
  cardOutline: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 16 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  actionRail: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingLeft: 12, gap: 8 },
  action: { width: 64, minHeight: 72, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14 },
  actionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: 'Montserrat-Medium', fontSize: 11 },
});
