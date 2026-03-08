import { TaskCard } from "@/components/task/TaskCard";
import { Button } from "@/components/ui/Button";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { KeyboardAvoidingView } from "@/components/ui/KeyboardAvoidingView";
import type { Task } from "@/db/schema";
import { useDialog } from "@/providers/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { bulkUpdateTasksGroup, createGroup, getAllTasks, getGroupById, getGroupByName, updateGroup } from "@/services/taskService";
import { shadows } from "@/theme/shadows";
import { adjustColor } from "@/utils/colors";
import clsx from "clsx";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    ArrowLeft,
    Check,
    Plus,
    Search,
    X
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
    FlatList, Platform,
    Text,
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
    const dialog = useDialog();
    const isDark = resolvedTheme === 'dark';
    const isEditing = !!id;

    const [name, setName] = useState("");
    const [emoji, setEmoji] = useState("📁");
    const [customEmojis, setCustomEmojis] = useState<string[]>([]);
    const [isEmojiModalVisible, setIsEmojiModalVisible] = useState(false);
    const [newEmojiInput, setNewEmojiInput] = useState("");
    const emojiInputRef = useRef<TextInput>(null);
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
            // Check for duplicate name
            const existingGroup = await getGroupByName(name.trim());
            if (existingGroup && (!isEditing || existingGroup.id !== Number(id))) {
                setSaving(false);
                dialog.show({
                    title: "Nome já existe",
                    description: `Já existe um grupo chamado "${name.trim()}". Por favor, escolha um nome diferente.`,
                    variant: "warning",
                    buttons: [{ text: "Entendido", variant: "default" }]
                });
                return;
            }

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

    const isEmoji = (str: string) => {
        const char = Array.from(str)[0];
        if (!char) return false;
        // Check if it's an emoji or symbolic character
        // Using a more compatible regex property for emojis
        return /\p{Emoji_Presentation}|\p{Emoji_Component}|\p{Extended_Pictographic}/u.test(char);
    };

    const getContrastColor = (hex: string) => {
        // Simple brightness calculation (YIQ)
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        // If background is light, darken text. If dark, lighten text.
        return brightness > 128 ? adjustColor(hex, -120) : adjustColor(hex, 120);
    };

    const iconStyle = {
        color: !isEmoji(emoji) ? getContrastColor(color) : undefined
    };

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
                                className="w-24 h-24 rounded-[2rem] items-center justify-center border-4 border-white/20"
                                style={[{ backgroundColor: color }, shadows.lg]}
                             >
                                <Text className="text-5xl" style={iconStyle}>{emoji}</Text>
                             </View>
                             <View className="flex-1">
                                <Text className="font-sans text-xs text-on-surface-secondary uppercase tracking-[0.2em] mb-2 px-1">Nome do Grupo</Text>
                                <TextInput
                                    placeholder="Ex: Trabalho"
                                    placeholderTextColor={isDark ? "#71717a" : "#a1a1aa"}
                                    value={name}
                                    onChangeText={setName}
                                    className="font-sans-bold"
                                    style={{ 
                                        color: isDark ? "#FAFAFA" : "#18181B",
                                        paddingVertical: 0,
                                        paddingHorizontal: 0,
                                        height: 32,
                                        fontSize: 24,
                                        lineHeight: 32,
                                        includeFontPadding: false,
                                        textAlignVertical: "center",
                                        marginLeft: 2,
                                    }}
                                    autoFocus
                                />
                             </View>
                        </View>

                        {/* Emoji Selection */}
                        <Text className="font-sans text-xs text-on-surface-secondary uppercase tracking-[0.2em] mb-4 px-1">Ícone</Text>
                        <View className="flex-row flex-wrap gap-3 mb-8 justify-center">
                            {[...PRESET_EMOJIS, ...customEmojis].map(e => (
                                <TouchableOpacity 
                                    activeOpacity={0.8}
                                    key={e}
                                    onPress={() => setEmoji(e)}
                                    className={clsx(
                                        "w-12 h-12 items-center justify-center rounded-2xl border-2",
                                        emoji === e ? "border-primary bg-primary/10" : "border-transparent bg-surface-secondary"
                                    )}
                                    style={emoji === e ? { borderColor: primaryColor } : {}}
                                >
                                    <Text className="text-2xl" style={!isEmoji(e) ? { color: isDark ? '#FFF' : '#000' } : {}}>{e}</Text>
                                </TouchableOpacity>
                            ))}
                            
                            <TouchableOpacity 
                                activeOpacity={0.8}
                                onPress={() => setIsEmojiModalVisible(true)}
                                className="w-12 h-12 items-center justify-center rounded-2xl border-2 border-dashed border-on-surface/20 bg-surface-secondary"
                            >
                                <Plus size={24} color={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"} />
                            </TouchableOpacity>
                        </View>

                        {/* Color Selection */}
                        <Text className="font-sans text-xs text-on-surface-secondary uppercase tracking-[0.2em] mb-4 px-1">Cor</Text>
                        <View className="mb-10">
                            <ColorPicker
                                selectedColor={color}
                                onSelect={setColor}
                                isDark={isDark}
                                colors={PRESET_COLORS}
                            />
                        </View>

                        {/* Task Selection Header */}
                        <View className="flex-row items-center justify-between mb-4 px-1">
                            <Text className="font-sans text-xs text-on-surface-secondary uppercase tracking-[0.2em]">Adicionar Notas</Text>
                            <Text className="font-sans text-xs text-primary" style={{ color: primaryColor }}>{selectedTasks.size} selecionadas</Text>
                        </View>
                        
                        <View 
                            className="flex-row items-center h-12 bg-surface-secondary rounded-2xl px-4 mb-4"
                            style={{ 
                                borderWidth: 1, 
                                borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" 
                            }}
                        >
                            <Search size={20} color={isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"} />
                            <TextInput
                                placeholder="Buscar notas..."
                                placeholderTextColor={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                className="flex-1 ml-3 font-sans text-base text-on-surface"
                            />
                        </View>
                    </View>
                }
                renderItem={({ item }) => (
                    <View className="mb-1">
                        <TaskCard
                            task={item}
                            selectionMode={true}
                            isSelected={selectedTasks.has(item.id)}
                            onSelect={() => toggleTaskSelection(item.id)}
                            onPress={() => router.push(`/task/${item.id}`)}
                        />
                    </View>
                )}
            />

            {/* Custom Emoji Bottom Sheet Overlay */}
            {isEmojiModalVisible && (
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    className="absolute inset-0 justify-end z-[100]"
                    style={[{ backgroundColor: 'rgba(0,0,0,0.6)' }]}
                >
                    <TouchableOpacity 
                        style={{ flex: 1 }} 
                        activeOpacity={1} 
                        onPress={() => setIsEmojiModalVisible(false)} 
                    />
                    <View 
                        className="p-6 gap-4 rounded-t-3xl" 
                        style={{ backgroundColor: isDark ? '#18181b' : '#f4f4f5', paddingBottom: Math.max(insets.bottom, 24) }}
                    >
                        <View className="flex-row items-center justify-between mb-2">
                            <Text className="font-sans-bold text-xl text-on-surface">Adicionar Ícone</Text>
                            <TouchableOpacity onPress={() => setIsEmojiModalVisible(false)} className="p-2 -mr-2">
                                <X size={24} color={isDark ? '#FFF' : '#000'} />
                            </TouchableOpacity>
                        </View>

                        <Text className="font-sans text-sm text-on-surface-secondary mb-1">
                            Digite ou cole um emoji, letra ou símbolo do teclado
                        </Text>

                        <View 
                            className="bg-surface rounded-2xl p-4 my-2 items-center justify-center border"
                            style={{ 
                                backgroundColor: isDark ? '#27272a' : '#FFFFFF',
                                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' 
                            }}
                        >
                            <TextInput
                                ref={emojiInputRef}
                                value={newEmojiInput}
                                onChangeText={(text) => {
                                    if (text.length > 0) {
                                        const chars = Array.from(text);
                                        setNewEmojiInput(chars[chars.length - 1]);
                                    } else {
                                        setNewEmojiInput("");
                                    }
                                }}
                                placeholder="😀"
                                placeholderTextColor={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}
                                className="text-5xl text-center w-full"
                                style={{ 
                                    color: isDark ? '#FAFAFA' : '#18181B',
                                    height: 64,
                                    paddingVertical: 0,
                                    includeFontPadding: false,
                                    textAlignVertical: 'center'
                                }}
                                autoFocus
                            />
                        </View>

                        <Button
                            rounded="full"
                            size="lg"
                            className="mt-2"
                            onPress={() => {
                                if (newEmojiInput.trim()) {
                                    setCustomEmojis(prev => [...prev, newEmojiInput.trim()]);
                                    setEmoji(newEmojiInput.trim());
                                    setNewEmojiInput("");
                                    setIsEmojiModalVisible(false);
                                }
                            }}
                            disabled={!newEmojiInput.trim()}
                        >
                            <Button.Text>Confirmar</Button.Text>
                        </Button>
                    </View>
                </KeyboardAvoidingView>
            )}
        </View>
    );
}
