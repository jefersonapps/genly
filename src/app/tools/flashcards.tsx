import { Button } from "@/components/ui/Button";
import { KeyboardAvoidingView } from "@/components/ui/KeyboardAvoidingView";
import type { Task } from "@/db/schema";
import { useDialog } from "@/providers/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { aiService, validateFlashcardsJSON } from "@/services/aiService";
import { createTask, getAllTasks, getGroupByName, getTaskById, updateTask } from "@/services/taskService";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Check, Download, FileEdit, FilePlus2, FileText, Library, MoreVertical, PlayCircle, Plus, Sparkles, Trash2, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Flashcard = {
    id: string;
    front: string;
    back: string;
}

export default function FlashcardsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === "dark";
  const dialog = useDialog();

  const { taskId } = useLocalSearchParams<{ taskId?: string }>();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [deckTitle, setDeckTitle] = useState("");
  
  useEffect(() => {
    async function hydrate() {
      if (!taskId) return;
      try {
        const t = await getTaskById(Number(taskId));
        if (t) {
          if (t.title) setDeckTitle(t.title);
          if (t.content) {
            const parsed = JSON.parse(t.content);
            if (Array.isArray(parsed)) {
              setCards(parsed);
            }
          }
        }
      } catch (e) {
        console.error("Failed to parse flashcards", e);
      }
    }
    hydrate();
  }, [taskId]);

  const [isStudying, setIsStudying] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showBack, setShowBack] = useState(false);
  
  // Options Sheet
  const optionsSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["50%"], []);
  const [isExporting, setIsExporting] = useState(false);
  const [showNoteSelector, setShowNoteSelector] = useState(false);
  const [allNotes, setAllNotes] = useState<Task[]>([]);

  const loadNotes = async () => {
    const list = await getAllTasks();
    setAllNotes(list);
  };

  // AI Generation state
  const [isAiModalVisible, setIsAiModalVisible] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAIGenerate = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    Keyboard.dismiss();
    setIsGenerating(true);
    setIsAiModalVisible(false);

    try {
      const result = await aiService.processJSON(aiPrompt.trim(), 'generate_flashcards');

      if (!result.success) {
        setIsGenerating(false);
        dialog.show({
          title: 'Erro na IA',
          description: result.error || 'Erro desconhecido na geração.',
          variant: 'error',
          buttons: [
            { text: 'Cancelar', variant: 'ghost' },
            {
              text: 'Tentar Novamente',
              variant: 'default',
              onPress: () => {
                setTimeout(() => setIsAiModalVisible(true), 300);
              },
            },
          ],
        });
        return;
      }

      if (!validateFlashcardsJSON(result.data)) {
        setIsGenerating(false);
        dialog.show({
          title: 'Formato Inválido',
          description: 'A IA retornou dados em um formato incompatível. Tente novamente com um prompt mais específico.',
          variant: 'warning',
          buttons: [
            { text: 'Cancelar', variant: 'ghost' },
            {
              text: 'Gerar Novamente',
              variant: 'default',
              onPress: () => {
                setTimeout(() => setIsAiModalVisible(true), 300);
              },
            },
          ],
        });
        return;
      }

      const newCards: Flashcard[] = result.data.map((item: any, index: number) => ({
        id: (Date.now() + index).toString(),
        front: item.front.trim(),
        back: item.back.trim(),
      }));

      setCards(prev => [...prev, ...newCards]);
      if (!deckTitle.trim()) {
        setDeckTitle(aiPrompt.trim());
      }
      setAiPrompt('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('AI Flashcard Error:', error);
      dialog.show({
        title: 'Erro',
        description: 'Ocorreu um erro ao gerar os flashcards.',
        variant: 'error',
        buttons: [{ text: 'OK', variant: 'default' }],
      });
    } finally {
      setIsGenerating(false);
    }
  }, [aiPrompt, dialog]);
  
  const handleSaveToDatabase = async () => {
    optionsSheetRef.current?.dismiss();
    setIsExporting(true);
    try {
      const group = await getGroupByName("Flashcards");
      if (!group) {
         dialog.show({ title: 'Erro', description: "Grupo 'Flashcards' não encontrado.", variant: 'error' });
         return;
      }
      
      const titleToSave = deckTitle.trim() || (cards.length > 0 ? `Deck: ${cards[0].front.substring(0, 30)}...` : "Novo Deck");
      const contentStr = JSON.stringify(cards);

      if (taskId) {
          await updateTask(Number(taskId), {
              title: titleToSave,
              content: contentStr,
              groupId: group.id
          });
      } else {
          const newTask = await createTask(titleToSave, contentStr, group.id);
          router.setParams({ taskId: newTask.id.toString() });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      dialog.show({ title: 'Sucesso', description: 'Flashcards salvos no banco de dados!', variant: 'success' });

    } catch (e) {
      console.error(e);
      dialog.show({ title: 'Erro', description: 'Falha ao salvar flashcards.', variant: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleAppendToNote = async (selectedTaskId: number) => {
    setShowNoteSelector(false);
    setIsExporting(true);
    try {
      const task = await getTaskById(selectedTaskId);
      if (task) {
        const textToAppend = `\n\n## Flashcards\n\n` + cards.map(c => `**Q:** ${c.front}\n**A:** ${c.back}`).join('\n\n');
        await updateTask(selectedTaskId, { content: (task.content || '') + textToAppend });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        dialog.show({ title: 'Sucesso', description: 'Flashcards adicionados à nota!', variant: 'success' });
      }
    } catch (e) {
        console.error(e);
        dialog.show({ title: 'Erro', description: 'Falha ao adicionar à nota.', variant: 'error' });
    } finally {
        setIsExporting(false);
    }
  };

  const handleCreateNoteFromCards = () => {
      optionsSheetRef.current?.dismiss();
      const textToAppend = `## Flashcards\n\n` + cards.map(c => `**Q:** ${c.front}\n**A:** ${c.back}`).join('\n\n');
      router.push({
          pathname: "/task/editor",
          params: { sharedText: textToAppend }
      });
  };

  const renderBackdrop = useCallback((props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
  ), []);
  
  // Animation state
  const spin = useSharedValue(0);

  const flipCard = () => {
    spin.value = spin.value ? 0 : 1;
    setShowBack(!showBack);
  };

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const spinVal = interpolate(spin.value, [0, 1], [0, 180]);
    return {
      transform: [
        { rotateY: withTiming(`${spinVal}deg`, { duration: 400, easing: Easing.inOut(Easing.ease) }) }
      ],
      backfaceVisibility: 'hidden',
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const spinVal = interpolate(spin.value, [0, 1], [180, 360]);
    return {
      transform: [
        { rotateY: withTiming(`${spinVal}deg`, { duration: 400, easing: Easing.inOut(Easing.ease) }) }
      ],
      backfaceVisibility: 'hidden',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    };
  });

  // Form State
  const [isAdding, setIsAdding] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');

  const handleAddCard = () => {
      if (!newFront || !newBack) return;
      
      setCards([...cards, {
          id: Date.now().toString(),
          front: newFront.trim(),
          back: newBack.trim()
      }]);
      setNewFront('');
      setNewBack('');
      setIsAdding(false);
  };

  const deleteCard = (id: string) => {
      setCards(cards.filter(c => c.id !== id));
  };

  const handleNextCard = () => {
      spin.value = 0; // reset spin for next card without animation
      setTimeout(() => {
          if (currentIdx < cards.length - 1) {
              setCurrentIdx(currentIdx + 1);
              setShowBack(false);
          } else {
              setIsStudying(false);
              setCurrentIdx(0);
              setShowBack(false);
          }
      }, 50); // Small delay to let spin value reset
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
        {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-outline/10">
        <View className="flex-row items-center">
          <Button 
            variant="icon" 
            onPress={() => router.back()} 
            className="mr-2"
          >
            <Button.Icon icon={<ArrowLeft size={24} color={isDark ? "#FFF" : "#000"} />} />
          </Button>
          <Text className="font-sans-bold text-xl text-on-surface">
            Flashcards
          </Text>
        </View>

        {isStudying ? (
          <Button 
            variant="ghost" 
            onPress={() => {
              setIsStudying(false);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Button.Icon icon={X} />
            <Button.Text>Sair</Button.Text>
          </Button>
        ) : (
          <View className="flex-row items-center gap-1">
            {cards.length > 0 && (
              <Button 
                variant="icon" 
                onPress={() => optionsSheetRef.current?.present()}
              >
                <Button.Icon icon={MoreVertical} />
              </Button>
            )}
            <Button 
              rounded="full" 
              onPress={handleSaveToDatabase}
              loading={isExporting}
              disabled={cards.length === 0}
            >
              <Button.Icon icon={Check} />
              <Button.Text className="ml-2">Salvar</Button.Text>
            </Button>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        
        {!isStudying && !isAdding && (
            <View className="px-4 mt-6">
                <View className="mb-6">
                    <Text className="font-sans-bold text-xl text-on-surface mb-2">Título do Baralho:</Text>
                    <TextInput 
                        value={deckTitle}
                        onChangeText={setDeckTitle}
                        placeholder="Ex: Anatomia Humana, Verbos em Inglês..."
                        placeholderTextColor={isDark ? "#555" : "#AAA"}
                        className="bg-surface-secondary p-4 rounded-2xl font-sans text-on-surface border border-outline/10"
                    />
                </View>

                <View className="flex-row items-center justify-between mb-4">
                    <Text className="font-sans-bold text-xl text-on-surface">Seus Cartões ({cards.length})</Text>
                    <Button 
                        size="sm"
                        onPress={() => setIsStudying(true)}
                        disabled={cards.length === 0}
                    >
                        <Button.Icon icon={PlayCircle} />
                        <Button.Text className="ml-2">Estudar</Button.Text>
                    </Button>
                </View>

                {cards.length === 0 ? (
                    <View className="items-center justify-center py-10 px-4 mt-8 rounded-3xl bg-surface-secondary border border-outline/10">
                        <View className="w-20 h-20 rounded-full items-center justify-center mb-6" style={{ backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}15` }}>
                            <Library size={40} color={primaryColor} />
                        </View>
                        <Text className="font-sans-bold text-xl text-on-surface text-center mb-2">Comece a Estudar</Text>
                        <Text className="font-sans text-on-surface-secondary text-center px-4 leading-relaxed mb-4">
                            Crie cartões com perguntas na frente e respostas no verso para testar seu conhecimento de forma ativa via repetição.
                        </Text>
                    </View>
                ) : (
                    <View className="gap-4">
                        {cards.map(card => (
                            <View key={card.id} className="p-4 rounded-2xl bg-surface-secondary" style={{ borderWidth: 1, borderColor: isDark ? "#2A2A2A" : "#E5E5E5" }}>
                                <View className="flex-row justify-between items-start">
                                    <View className="flex-1 pr-4 border-r" style={{ borderColor: isDark ? "#2A2A2A" : "#E5E5E5" }}>
                                        <Text className="font-sans-bold text-on-surface mb-1">Frente:</Text>
                                        <Text className="font-sans text-on-surface-secondary mb-3">{card.front}</Text>
                                        
                                        <Text className="font-sans-bold text-on-surface mb-1">Verso:</Text>
                                        <Text className="font-sans text-on-surface-secondary">{card.back}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => deleteCard(card.id)} className="pl-4 py-2">
                                        <Trash2 size={20} color={isDark ? "#555" : "#CCC"} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                <Button 
                    onPress={() => setIsAdding(true)}
                    variant="ghost"
                    className="mt-6 border-2 border-dashed h-16"
                    style={{ borderColor: primaryColor, backgroundColor: isDark ? `${primaryColor}15` : `${primaryColor}10` }}
                >
                    <Button.Icon icon={Plus} color={primaryColor} size={24} />
                    <Button.Text style={{ color: primaryColor }} className="text-lg ml-2">Adicionar Cartão</Button.Text>
                </Button>

                <Button 
                    onPress={() => {
                        setIsAiModalVisible(true);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    variant="ghost"
                    className="mt-3 h-16 border bg-surface-secondary"
                    style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                    color={primaryColor}
                >
                    <Button.Icon icon={Sparkles} color={primaryColor} size={20} />
                    <Button.Text style={{ color: primaryColor }} className="text-lg ml-2">Gerar com IA</Button.Text>
                </Button>
            </View>
        )}

        {isAdding && (
            <View className="px-5 mt-6">
                <Text className="font-sans-bold text-on-surface mb-2">Frente (Pergunta):</Text>
                <TextInput 
                    value={newFront}
                    onChangeText={setNewFront}
                    placeholder="Ex: Qual a capital da França?"
                    placeholderTextColor={isDark ? "#555" : "#AAA"}
                    className="bg-surface-secondary p-4 rounded-xl font-sans text-on-surface mb-6 border border-outline/10"
                    multiline
                    textAlignVertical="top"
                    style={{ minHeight: 100 }}
                />

                <Text className="font-sans-bold text-on-surface mb-2">Verso (Resposta):</Text>
                <TextInput 
                    value={newBack}
                    onChangeText={setNewBack}
                    placeholder="Ex: Paris"
                    placeholderTextColor={isDark ? "#555" : "#AAA"}
                    className="bg-surface-secondary p-4 rounded-xl font-sans text-on-surface mb-8 border border-outline/10"
                    multiline
                    textAlignVertical="top"
                    style={{ minHeight: 120 }}
                />

                <Button 
                    size="lg"
                    rounded="full"
                    onPress={handleAddCard}
                    disabled={!newFront || !newBack}
                    className="shadow-sm"
                >
                    <Button.Text>Salvar Cartão</Button.Text>
                </Button>
            </View>
        )}

        {isStudying && cards.length > 0 && (
             <View className="px-4 mt-10 items-center justify-center flex-1">
                 <Text className="font-sans-medium text-on-surface-secondary mb-6">
                     Cartão {currentIdx + 1} de {cards.length}
                 </Text>
                 
                 <View className="w-full min-h-[300px] perspective-1000">
                     <TouchableOpacity activeOpacity={1} onPress={flipCard} className="w-full h-full">
                         
                         {/* FRONT OF CARD */}
                         <Animated.View 
                            className="w-full h-full rounded-3xl p-8 items-center justify-center shadow-md bg-surface"
                            style={[
                                frontAnimatedStyle,
                                { 
                                    borderWidth: 1, 
                                    borderColor: isDark ? "#333" : "#E5E5E5",
                                    backgroundColor: isDark ? "#1C1C1E" : "#FFF"
                                }
                            ]}
                         >
                             <Text className="font-sans-medium text-primary mb-4 text-sm uppercase tracking-widest text-center" style={{ color: primaryColor }}>
                                 Pergunta
                             </Text>
                             <Text className="font-sans-bold text-2xl text-on-surface text-center leading-loose">
                                 {cards[currentIdx].front}
                             </Text>
                             <Text className="font-sans text-on-surface-secondary mt-10 text-sm">
                                 Toque para virar
                             </Text>
                         </Animated.View>

                         {/* BACK OF CARD */}
                         <Animated.View 
                            className="w-full h-full rounded-3xl p-8 items-center justify-center shadow-md bg-surface"
                            style={[
                                backAnimatedStyle,
                                { 
                                    borderWidth: 1, 
                                    borderColor: primaryColor,
                                    backgroundColor: isDark ? `${primaryColor}15` : `${primaryColor}10`
                                }
                            ]}
                         >
                             <Text className="font-sans-medium text-primary mb-4 text-sm uppercase tracking-widest text-center" style={{ color: primaryColor }}>
                                 Resposta
                             </Text>
                             <Text className="font-sans-bold text-2xl text-on-surface text-center leading-loose">
                                 {cards[currentIdx].back}
                             </Text>
                         </Animated.View>

                     </TouchableOpacity>
                 </View>

                 {showBack && (
                      <View className="w-full mt-10">
                        <Button 
                            size="lg"
                            rounded="full"
                            onPress={handleNextCard}
                            className="shadow-sm"
                        >
                            <Button.Text>
                                {currentIdx < cards.length - 1 ? "Próximo Cartão" : "Finalizar Estudo"}
                            </Button.Text>
                        </Button>
                      </View>
                 )}
             </View>
        )}

      </ScrollView>

      {/* Options bottom sheet */}
      <BottomSheetModal
        ref={optionsSheetRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: isDark ? '#18181b' : '#f4f4f5' }}
        handleIndicatorStyle={{ backgroundColor: isDark ? '#52525b' : '#d4d4d8' }}
      >
        <BottomSheetView className="p-6 gap-4" style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
          <Text className="font-sans-bold text-xl text-on-surface mb-2">Opções</Text>

          <Button 
            variant="ghost"
            onPress={handleSaveToDatabase}
            className="flex-row items-center p-4 bg-surface-secondary rounded-2xl border border-border"
          >
            <View className="h-10 w-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: 'rgba(59,130,246,0.1)' }}>
              <Download size={20} color="#3B82F6" />
            </View>
            <Button.Text className="flex-1 text-left">Salvar no Banco de Dados</Button.Text>
          </Button>

          <Button 
            variant="ghost"
            onPress={() => {
               optionsSheetRef.current?.dismiss();
               loadNotes();
               setShowNoteSelector(true);
            }}
            className="flex-row items-center p-4 bg-surface-secondary rounded-2xl border border-border mt-2"
          >
            <View className="h-10 w-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: 'rgba(59,130,246,0.1)' }}>
              <FilePlus2 size={20} color="#3B82F6" />
            </View>
            <Button.Text className="flex-1 text-left">Adicionar a uma nota existente</Button.Text>
          </Button>

          <Button 
            variant="ghost"
            onPress={handleCreateNoteFromCards}
            className="flex-row items-center p-4 bg-surface-secondary rounded-2xl border border-border mt-2"
          >
            <View className="h-10 w-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: 'rgba(59,130,246,0.1)' }}>
              <FileEdit size={20} color="#3B82F6" />
            </View>
            <Button.Text className="flex-1 text-left">Criar uma nova nota com os cartões</Button.Text>
          </Button>

        </BottomSheetView>
      </BottomSheetModal>

      {/* Note Selector Modal */}
      <Modal visible={showNoteSelector} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
           <View className="bg-surface rounded-t-3xl pt-6 h-[80%]" style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
             <View className="px-6 mb-4 flex-row justify-between items-center">
                <Text className="font-sans-bold text-xl text-on-surface">Selecionar Nota</Text>
                <TouchableOpacity onPress={() => setShowNoteSelector(false)} className="p-2 -mr-2">
                   <Text className="font-sans-medium text-primary">Cancelar</Text>
                </TouchableOpacity>
             </View>
             <FlatList
               data={allNotes}
               keyExtractor={(item) => item.id.toString()}
               contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
               ItemSeparatorComponent={() => <View className="h-px bg-border/50 my-2" />}
               renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => handleAppendToNote(item.id)} className="py-3 flex-row items-center">
                     <FileText size={20} color={isDark ? '#D4D4D8' : '#52525B'} className="mr-3" />
                     <View className="flex-1">
                        <Text className="font-sans-medium text-base text-on-surface" numberOfLines={1}>{item.title}</Text>
                        <Text className="font-sans text-xs text-on-surface-secondary mt-1">{new Date(item.updatedAt).toLocaleDateString()}</Text>
                     </View>
                  </TouchableOpacity>
               )}
               ListEmptyComponent={() => (
                 <Text className="font-sans text-center text-on-surface-secondary py-8">Nenhuma nota encontrada.</Text>
               )}
             />
           </View>
        </View>
      </Modal>

      {/* AI Generation Overlay (Not a Modal to fix Android keyboard) */}
      {isAiModalVisible && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', zIndex: 100 }]}>
          <TouchableOpacity 
            style={{ flex: 1 }} 
            activeOpacity={1} 
            onPress={() => setIsAiModalVisible(false)} 
          />
          <View className="p-6 gap-4 rounded-t-3xl" style={{ backgroundColor: isDark ? '#18181b' : '#f4f4f5', paddingBottom: Math.max(insets.bottom, 24) }}>
            <View className="flex-row items-center gap-3 mb-1">
              <View className="h-10 w-10 rounded-full items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
                <Sparkles size={20} color={primaryColor} />
              </View>
              <View className="flex-1">
                <Text className="font-sans-bold text-xl text-on-surface">Gerar com IA</Text>
                <Text className="font-sans text-xs text-on-surface-secondary">Descreva o tema para criar flashcards</Text>
              </View>
            </View>
            <TextInput
              value={aiPrompt}
              onChangeText={setAiPrompt}
              placeholder="Ex: Capitais da Europa, Verbos em Inglês, Anatomia Humana..."
              placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
              style={{
                backgroundColor: isDark ? '#27272A' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                color: isDark ? '#FAFAFA' : '#18181B',
                borderWidth: 1,
                borderRadius: 14,
                padding: 16,
                fontSize: 16,
                minHeight: 100,
                fontFamily: 'Montserrat-Regular',
              }}
            />
            <Button
              size="lg"
              onPress={handleAIGenerate}
              disabled={!aiPrompt.trim() || isGenerating}
              loading={isGenerating}
              className="mt-2"
            >
              {!isGenerating && <Button.Icon icon={Sparkles} />}
              <Button.Text>{isGenerating ? 'Gerando...' : 'Gerar Flashcards'}</Button.Text>
            </Button>
          </View>
        </View>
      )}

      {/* Overlay Loading */}
      {isGenerating && (
        <View className="absolute z-50 top-0 left-0 right-0 bottom-0 bg-black/60 items-center justify-center">
          <View className="bg-surface p-6 rounded-2xl items-center shadow-lg">
            <ActivityIndicator size="large" color={primaryColor} />
            <Text className="font-sans-semibold mt-4 text-on-surface text-base">Gerando flashcards com IA...</Text>
          </View>
        </View>
      )}
      </View>
    </KeyboardAvoidingView>
  );
}

