import { Button } from "@/components/ui/Button";
import type { Task } from "@/db/schema";
import { useTheme } from "@/providers/ThemeProvider";
import { bulkUpdateTasksGroup, createGroup, getAllTasks, getGroupById, updateGroup } from "@/services/taskService";
import { stripMarkdown, truncateText } from "@/utils/markdown";
import clsx from "clsx";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    ArrowLeft,
    Check,
    Search
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    FlatList, Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRESET_EMOJIS = ["📁", "🏠", "💼", "📚", "🎨", "🎮", "🌟", "🔥", "💡"];
const PRESET_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6", "#71717a"];

export default function GroupEditorScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { primaryColor, resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';
    const isEditing = !!id;

    const [name, setName] = useState("");
    const [emoji, setEmoji] = useState("📁");
    const [color, setColor] = useState("#6366f1");
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
    const [searchQuery, setSearchQuery] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        const allTasks = await getAllTasks();
        setTasks(allTasks);

        if (isEditing) {
            const group = await getGroupById(Number(id));
            if (group) {
                setName(group.name);
                setEmoji(group.emoji || "📁");
                setColor(group.color || "#6366f1");
                
                const inGroup = allTasks
                    .filter(t => t.groupId === group.id)
                    .map(t => t.id);
                setSelectedTasks(new Set(inGroup));
            }
        }
    };

    const toggleTaskSelection = (taskId: number) => {
        const next = new Set(selectedTasks);
        if (next.has(taskId)) {
            next.delete(taskId);
        } else {
            next.add(taskId);
        }
        setSelectedTasks(next);
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            let groupId: number;
            if (isEditing) {
                groupId = Number(id);
                await updateGroup(groupId, { name: name.trim(), emoji, color });
            } else {
                const group = await createGroup(name.trim(), emoji, color);
                groupId = group.id;
            }

            const allTasksInGroup = tasks.filter(t => t.groupId === groupId).map(t => t.id);
            const tasksToRemove = allTasksInGroup.filter(taskId => !selectedTasks.has(taskId));
            
            if (tasksToRemove.length > 0) {
                await bulkUpdateTasksGroup(tasksToRemove, null);
            }

            if (selectedTasks.size > 0) {
                await bulkUpdateTasksGroup(Array.from(selectedTasks), groupId);
            }
            
            router.back();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const filteredTasks = tasks.filter(t => 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.content?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-border bg-surface">
                <View className="flex-row items-center flex-1">
                    <Button variant="icon" onPress={() => router.back()} className="mr-1">
                        <Button.Icon icon={<ArrowLeft size={24} color={isDark ? '#FFF' : '#000'} />} />
                    </Button>
                    <Text className="font-sans-bold text-xl text-on-surface">
                        {isEditing ? "Editar Grupo" : "Novo Grupo"}
                    </Text>
                </View>

                <Button
                    rounded="full"
                    onPress={handleSave}
                    disabled={!name.trim()}
                    loading={saving}
                >
                    <Button.Icon icon={<Check size={20} color="#FFF" />} />
                    <Button.Text className="ml-2">Salvar</Button.Text>
                </Button>
            </View>

            <FlatList
                data={filteredTasks}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                ListHeaderComponent={
                    <View className="mb-8">
                        {/* Name & Icon Section */}
                        <View className="flex-row items-center mb-10 gap-6">
                             <View 
                                className="w-24 h-24 rounded-[2rem] items-center justify-center shadow-lg border-4 border-white/20"
                                style={{ backgroundColor: color }}
                             >
                                <Text className="text-5xl">{emoji}</Text>
                             </View>
                             <View className="flex-1">
                                <Text className="font-sans text-xs text-on-surface-secondary uppercase tracking-[0.2em] mb-2 px-1">Nome do Grupo</Text>
                                <TextInput
                                    placeholder="Ex: Trabalho"
                                    placeholderTextColor={isDark ? "#71717a" : "#a1a1aa"}
                                    value={name}
                                    onChangeText={setName}
                                    className="font-sans-bold text-2xl text-on-surface p-1"
                                    autoFocus
                                />
                             </View>
                        </View>

                        {/* Emoji Selection */}
                        <Text className="font-sans text-xs text-on-surface-secondary uppercase tracking-[0.2em] mb-4 px-1">Ícone</Text>
                        <View className="flex-row flex-wrap gap-3 mb-8">
                            {PRESET_EMOJIS.map(e => (
                                <TouchableOpacity 
                                    key={e}
                                    onPress={() => setEmoji(e)}
                                    className={clsx(
                                        "w-12 h-12 items-center justify-center rounded-2xl border-2",
                                        emoji === e ? "border-primary bg-primary/10" : "border-transparent bg-surface-secondary"
                                    )}
                                    style={emoji === e ? { borderColor: primaryColor } : {}}
                                >
                                    <Text className="text-2xl">{e}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Color Selection */}
                        <Text className="font-sans text-xs text-on-surface-secondary uppercase tracking-[0.2em] mb-4 px-1">Cor</Text>
                        <View className="flex-row flex-wrap gap-4 mb-10">
                            {PRESET_COLORS.map(c => (
                                <TouchableOpacity 
                                    key={c}
                                    onPress={() => setColor(c)}
                                    className={clsx(
                                        "w-10 h-10 rounded-full border-4 items-center justify-center",
                                        color === c ? "border-on-surface/20" : "border-transparent"
                                    )}
                                    style={{ backgroundColor: c }}
                                >
                                    {color === c && <View className="w-3 h-3 rounded-full bg-white" />}
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Task Selection Header */}
                        <View className="flex-row items-center justify-between mb-4 px-1">
                            <Text className="font-sans text-xs text-on-surface-secondary uppercase tracking-[0.2em]">Adicionar Tarefas</Text>
                            <Text className="font-sans text-xs text-primary" style={{ color: primaryColor }}>{selectedTasks.size} selecionadas</Text>
                        </View>
                        
                        <View className="flex-row items-center bg-surface-secondary rounded-2xl px-4 py-3 mb-4 border border-border">
                            <Search size={18} color="#71717a" />
                            <TextInput
                                placeholder="Buscar tarefas..."
                                placeholderTextColor="#71717a"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                className="flex-1 ml-3 font-sans text-on-surface"
                            />
                        </View>
                    </View>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity 
                        onPress={() => toggleTaskSelection(item.id)}
                        activeOpacity={0.7}
                        className={clsx(
                            "flex-row items-center p-4 rounded-3xl mb-3 border",
                            selectedTasks.has(item.id) ? "bg-primary/10 border-primary/30" : "bg-surface-secondary border-transparent"
                        )}
                        style={selectedTasks.has(item.id) ? { borderColor: primaryColor + '40', backgroundColor: primaryColor + '10' } : {}}
                    >
                        <View 
                            className={clsx(
                                "w-6 h-6 rounded-lg border-2 items-center justify-center mr-4",
                                selectedTasks.has(item.id) ? "bg-primary border-primary" : "border-border"
                            )}
                            style={selectedTasks.has(item.id) ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                        >
                            {selectedTasks.has(item.id) && <Check size={14} color="#FFF" />}
                        </View>
                        <View className="flex-1">
                            <Text className="font-sans-bold text-on-surface" numberOfLines={1}>{item.title}</Text>
                            {item.content && <Text className="font-sans text-xs text-on-surface-secondary mt-0.5" numberOfLines={1}>{truncateText(stripMarkdown(item.content), 80)}</Text>}
                        </View>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}
