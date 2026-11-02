import { hasMindMapContent, MindMapAutosave, type AutosaveState } from '@/lib/mindmap/autosave';
import { saveMindMapDocument } from '@/services/mindMapPersistence';
import { useBackOrHome } from "@/hooks/useBackOrHome";
import BottomSheet from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { ColorPicker, PRESET_COLORS } from '@/components/ui/ColorPicker';
import { KeyboardAvoidingView } from "@/components/ui/KeyboardAvoidingView";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { ToolActions } from "@/components/ui/ToolActions";
import { exportToImage } from '@/lib/mindmap/exportUtils';
import { computeChildDirs, computeHiddenNodes, computeLayout } from '@/lib/mindmap/layoutEngine';
import { MindMapCanvas } from '@/lib/mindmap/MindMapCanvas';
import { useMapGestures } from '@/lib/mindmap/useMapGestures';
import { NODE_DEFAULT_HEIGHT, NODE_DEFAULT_WIDTH, useMindMapStore, type MindMapNode } from '@/lib/mindmap/useMindMapStore';
import { useDialog } from '@/providers/DialogProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { aiService, validateMindMapJSON } from '@/services/aiService';
import { withOpacity } from '@/utils/colors';
import { copyToMediaDir } from '@/utils/file';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useFont } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronLeft,
  Download,
  Expand,
  Image as ImageIcon,
  Maximize,
  Network,
  Palette,
  Plus,
  Settings,
  Share2,
  Sparkles,
  Trash2, Type
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Keyboard,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions
} from "react-native";

import { getTaskById } from '@/services/taskService';
import { shadows } from '@/theme/shadows';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function currentMapDocument() {
  const { nodes, rootId, canvasBgColor, bgPattern } = useMindMapStore.getState();
  return { nodes, rootId, canvasBgColor, bgPattern };
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
 
// ─── Inline Editor Component ──────────────────────────
const InlineNodeEditor = React.memo(({ 
  node, text, onTextChange, onSave, transform, isDark 
}: { 
  node: MindMapNode; 
  text: string; 
  onTextChange: (t: string) => void; 
  onSave: () => void; 
  transform: any;
  isDark: boolean;
}) => {
  // Simple version of the logic in MindMapCanvas
  const getTextColor = () => {
    if (node.color) return '#FFFFFF'; // Simplified
    if (node.depth === 0) return '#FFFFFF';
    return isDark ? '#E5E7EB' : '#1F2937';
  };
  const textColor = getTextColor();

  const animatedStyle = useAnimatedStyle(() => {
    const s = transform.scale.value;
    return {
      position: 'absolute',
      left: 0,
      top: 0,
      width: node.width * s,
      height: node.height * s,
      transform: [
        { translateX: transform.translateX.value + node.x * s },
        { translateY: transform.translateY.value + node.y * s },
      ],
      zIndex: 9999,
      justifyContent: 'center',
    };
  }, Platform.OS === 'web' ? [node, transform] : undefined);

  const animatedTextStyle = useAnimatedStyle(() => {
    const s = transform.scale.value;
    const lh = 13 * 1.5 * s; // Match LINE_HEIGHT_FACTOR = 1.5
    
    let mb = 0;
    if (node.imageUri && node.imageAspectRatio) {
      const imgW = (node.width - 32); 
      const imgH = imgW / node.imageAspectRatio;
      mb = (imgH + 16) * s; // 16px gap
    }

    return {
      fontSize: 13 * s,
      lineHeight: lh,
      paddingHorizontal: 16 * s,
      paddingVertical: 0,
      marginBottom: mb,
    };
  });

  return (
    <Animated.View style={animatedStyle} pointerEvents="auto">
      <AnimatedTextInput
        value={text}
        onChangeText={onTextChange}
        autoFocus
        multiline
        onBlur={onSave}
        placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
        style={[
          {
            color: textColor,
            fontFamily: 'Montserrat-SemiBold',
            textAlign: node.textAlign || 'center',
            backgroundColor: 'transparent',
            padding: 0,
            margin: 0,
            includeFontPadding: false,
            height: undefined, // Auto-height based on text + lineHeight
          },
          animatedTextStyle
        ]}
      />
    </Animated.View>
  );
});

export default function MindMapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const goBack = useBackOrHome();
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const dialog = useDialog();

  const font = useFont(require('../../../assets/fonts/Montserrat-SemiBold.ttf'), 13);

  const nodes          = useMindMapStore((s) => s.nodes);
  const rootId         = useMindMapStore((s) => s.rootId);
  const selectedId     = useMindMapStore((s) => s.selectedId);
  const addNode        = useMindMapStore((s) => s.addNode);
  const deleteNode     = useMindMapStore((s) => s.deleteNode);
  const updateNodeTitle = useMindMapStore((s) => s.updateNodeTitle);
  const pinNodePosition = useMindMapStore((s) => s.pinNodePosition);
  const resizeNode     = useMindMapStore((s) => s.resizeNode);
  const setNodeColor   = useMindMapStore((s) => s.setNodeColor);
  const setTextAlign   = useMindMapStore((s) => s.setTextAlign);
  const setNodeImage   = useMindMapStore((s) => s.setNodeImage);
  const toggleCollapse = useMindMapStore((s) => s.toggleCollapse);
  const toggleCollapseDir = useMindMapStore((s) => s.toggleCollapseDir);
  const expandAll      = useMindMapStore((s) => s.expandAll);
  const collapseAll    = useMindMapStore((s) => s.collapseAll);
  const initRoot       = useMindMapStore((s) => s.initRoot);
  const select         = useMindMapStore((s) => s.select);
  const canvasBgColor  = useMindMapStore((s) => s.canvasBgColor);
  const setCanvasBgColor = useMindMapStore((s) => s.setCanvasBgColor);
  const bgPattern      = useMindMapStore((s) => s.bgPattern);
  const setBgPattern   = useMindMapStore((s) => s.setBgPattern);



  const colorSheetRef  = useRef<BottomSheetModal>(null);
  const exportSheetRef = useRef<BottomSheetModal>(null);
  const bgSheetRef     = useRef<BottomSheetModal>(null);
  
  const [isEditTopicVisible, setIsEditTopicVisible] = useState(false);
  const colorSnapPoints = useMemo(() => ['70%'], []);
  const exportSnapPoints = useMemo(() => ['50%'], []);
  const bgSnapPoints   = useMemo(() => ['55%'], []);
  
  const [editText, setEditText] = useState('');
  
  const layoutNodes = useMemo(() => {
    const nodesForLayout = nodes.map(n => 
      n.id === selectedId && isEditTopicVisible ? { ...n, title: editText } : n
    );
    return computeLayout(nodesForLayout, rootId);
  }, [nodes, rootId, selectedId, isEditTopicVisible, editText]);
  const childDirsMap = useMemo(() => computeChildDirs(layoutNodes), [layoutNodes]);
  const hiddenNodes = useMemo(() => computeHiddenNodes(layoutNodes), [layoutNodes]);

  const [isExporting, setIsExporting] = useState(false);

  // AI Generation state
  const [isAiModalVisible, setIsAiModalVisible] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const convertMindMapJSON = useCallback((data: { rootTitle: string; color?: string; children: any[] }): { nodes: MindMapNode[]; rootId: string } => {
    const nodes: MindMapNode[] = [];
    const generateId = () => Math.random().toString(36).substr(2, 9);

    const rootId = generateId();
    nodes.push({
      id: rootId,
      parentId: null,
      title: data.rootTitle,
      x: 0, y: 0,
      width: NODE_DEFAULT_WIDTH,
      height: NODE_DEFAULT_HEIGHT,
      collapsed: false,
      depth: 0,
      color: data.color,
    });

    const processChildren = (children: any[], parentId: string, depth: number, parentDir?: 'left' | 'right') => {
      let index = 0;
      for (const child of children) {
        const childId = generateId();
        const dir = depth === 1 ? (index % 2 === 0 ? 'right' : 'left') : parentDir;
        nodes.push({
          id: childId,
          parentId,
          title: child.title,
          x: 0, y: 0,
          width: NODE_DEFAULT_WIDTH,
          height: NODE_DEFAULT_HEIGHT,
          collapsed: false,
          layoutDir: dir,
          depth,
          color: child.color,
        });
        if (child.children && child.children.length > 0) {
          processChildren(child.children, childId, depth + 1, dir);
        }
        index++;
      }
    };

    processChildren(data.children, rootId, 1);
    return { nodes, rootId };
  }, []);


  const handleShareImage = async () => {
    exportSheetRef.current?.dismiss();
    setIsExporting(true);
    try {
      const uri = await exportToImage(layoutNodes, isDark, font, canvasBgColor, bgPattern);
      if (uri) await Sharing.shareAsync(uri, { mimeType: 'image/png' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveImage = async () => {
    exportSheetRef.current?.dismiss();
    setIsExporting(true);
    try {
      const uri = await exportToImage(layoutNodes, isDark, font, canvasBgColor, bgPattern);
      if (uri) {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          await MediaLibrary.createAssetAsync(uri);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          dialog.show({ title: 'Sucesso', description: 'A imagem foi salva na sua galeria!', variant: 'success' });
        } else {
          await Sharing.shareAsync(uri, { mimeType: 'image/png' });
        }
      }
    } finally {
      setIsExporting(false);
    }
  };

  const { taskId, template, mapSession } = useLocalSearchParams<{ taskId?: string; template?: string; mapSession?: string }>();
  const hasCenteredOnLoad = useRef(false);
  const autosaveRef = useRef<MindMapAutosave | null>(null);
  const hasTypedMapText = useRef(false);
  const initializedSession = useRef<string | null>(null);
  const leavingRef = useRef(false);
  const [savedMapId, setSavedMapId] = useState<number | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveState>('saved');
  const [isLoadingMap, setIsLoadingMap] = useState(true);

  const handleBack = useCallback(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    try {
      autosaveRef.current?.update(currentMapDocument(), hasTypedMapText.current);
      await autosaveRef.current?.flush();
      goBack();
    } catch {
      dialog.show({ title: 'Não foi possível salvar', description: 'O mapa continua aberto. Tente voltar novamente para salvar suas alterações.', variant: 'error' });
    } finally { leavingRef.current = false; }
  }, [goBack, dialog.show]);

  useFocusEffect(useCallback(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => { void handleBack(); return true; });
    const background = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        autosaveRef.current?.update(currentMapDocument(), hasTypedMapText.current);
        void autosaveRef.current?.flush().catch(() => {});
      }
    });
    return () => {
      back.remove(); background.remove();
      void autosaveRef.current?.flush().catch(() => {});
    };
  }, [handleBack]));

  const handleSaveToDatabase = async (createNew = false) => {
    Keyboard.dismiss();
    setIsEditTopicVisible(false);
    exportSheetRef.current?.dismiss();
    setIsExporting(true);
    try {
      const saver = autosaveRef.current;
      if (!saver) return;
      if (!hasMindMapContent(currentMapDocument())) {
        dialog.show({ title: 'Adicione conteúdo ao mapa', description: 'Escreva uma ideia ou adicione uma imagem antes de salvar.', variant: 'info' });
        return;
      }
      saver.update(currentMapDocument(), true);
      await saver.flush();
      if (createNew) {
        const id = await saveMindMapDocument(null, currentMapDocument());
        router.setParams({ taskId: String(id) });
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      dialog.show({ title: 'Não foi possível salvar', description: 'Tente novamente. Suas alterações continuam abertas.', variant: 'error' });
    } finally { setIsExporting(false); }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      dialog.show({ title: 'Permissão Negada', description: 'Precisamos de acesso à galeria para adicionar imagens.', variant: 'error' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      if (selectedId) {
        try {
          const permanentUri = await copyToMediaDir(asset.uri);
          setNodeImage(selectedId, permanentUri, asset.width / asset.height);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          colorSheetRef.current?.dismiss();
        } catch (error) {
          console.error("Failed to copy image:", error);
          dialog.show({ title: 'Erro', description: 'Não foi possível salvar a imagem permanentemente.', variant: 'error' });
        }
      }
    }
  };


  useFocusEffect(useCallback(() => {
    let cancelled = false;
    const sessionKey = JSON.stringify([taskId, template, mapSession]);
    const continuingSession = initializedSession.current === sessionKey;
    initializedSession.current = sessionKey;
    let unsubscribe: (() => void) | undefined;
    setIsLoadingMap(true);
    setIsEditTopicVisible(false);
    hasCenteredOnLoad.current = false;
    hasTypedMapText.current = false;
    const previous = autosaveRef.current;
    autosaveRef.current = null;
    async function initializeMap() {
      try {
        await previous?.flush();
        if (cancelled) return;
        useMindMapStore.getState().reset();
        const id: number | null = taskId ? Number(taskId) : continuingSession ? previous?.id ?? null : null;
        if (id !== null) {
          const task = await getTaskById(id);
          if (cancelled) return;
          const data = task?.content ? JSON.parse(task.content) : null;
          if (!data || !Array.isArray(data.nodes)) throw new Error('Mapa não encontrado');
          useMindMapStore.getState().setWholeState({ nodes: data.nodes, rootId: data.rootId,
            canvasBgColor: data.canvasBgColor ?? null, bgPattern: data.bgPattern || 'none', selectedId: null });
        } else if (template) {
          const store = useMindMapStore.getState();
          store.initRoot(template === 'study' ? 'Tópico de Estudo' : 'Ideia Principal');
          const root = useMindMapStore.getState().rootId!;
          for (const title of template === 'study' ? ['Conceitos Chave', 'Exemplos', 'Dúvidas'] : ['Prós', 'Contras', 'Recursos']) store.addNode(root, title);
          hasTypedMapText.current = true;
        } else if (mapSession) {
          useMindMapStore.getState().initRoot('Ideia Central');
        }
        if (cancelled) return;
        const saver = new MindMapAutosave(id, saveMindMapDocument, (status, savedId) => {
          if (!cancelled) { setAutosaveStatus(status); setSavedMapId(savedId); }
        });
        if (id !== null) saver.initialize(currentMapDocument());
        autosaveRef.current = saver;
        setSavedMapId(id);
        setAutosaveStatus(hasMindMapContent(currentMapDocument()) ? 'saved' : 'empty');
        unsubscribe = useMindMapStore.subscribe(() => saver.update(currentMapDocument(), hasTypedMapText.current));
        if (template && id === null) saver.update(currentMapDocument(), true);
      } catch {
        if (!cancelled) { autosaveRef.current = previous; setAutosaveStatus('error'); }
        if (!cancelled) dialog.show({ title: 'Não foi possível abrir o mapa', description: 'Volte à biblioteca e tente novamente.', variant: 'error' });
      } finally { if (!cancelled) setIsLoadingMap(false); }
    }
    void initializeMap();
    return () => {
      cancelled = true;
      unsubscribe?.();
      const saver = autosaveRef.current;
      void saver?.flush().catch(() => {});
    };
  }, [taskId, template, mapSession]));


  const openEditSheet = useCallback((id: string) => {
    select(id);
    const node = nodes.find((n) => n.id === id);
    if (node) {
      setEditText(node.title === 'Novo tópico' ? '' : node.title);
      setIsEditTopicVisible(true);
    }
  }, [nodes, select]);

  useEffect(() => {
    if (selectedId && !layoutNodes.find((n) => n.id === selectedId)) select(null);
  }, [layoutNodes, selectedId, select]);

  const handleNodeTap = useCallback((id: string) => {
    if (isEditTopicVisible && selectedId && selectedId !== id) {
      if (editText.trim()) updateNodeTitle(selectedId, editText.trim());
      setIsEditTopicVisible(false);
    }
    select(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isEditTopicVisible, selectedId, editText, updateNodeTitle, select]);

  const handleDoubleTap = useCallback((id: string) => {
    openEditSheet(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [openEditSheet]);

  const handleBackgroundTap = useCallback(() => { 
    if (isEditTopicVisible && selectedId) {
      if (editText.trim()) updateNodeTitle(selectedId, editText.trim());
      setIsEditTopicVisible(false);
    }
    select(null); 
  }, [isEditTopicVisible, selectedId, editText, updateNodeTitle, select]);

  const handleDragStart = useCallback((id: string) => {
    if (isEditTopicVisible && selectedId && selectedId !== id) {
      if (editText.trim()) updateNodeTitle(selectedId, editText.trim());
      setIsEditTopicVisible(false);
    }
    select(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, [isEditTopicVisible, selectedId, editText, updateNodeTitle, select]);

  const handleDragEnd = useCallback((id: string, absX: number, absY: number) => {
    pinNodePosition(id, absX, absY);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [pinNodePosition]);

  /**
   * Resize end: persist final dimensions.
   * resizeNodeId stays set in the shared value so the canvas keeps rendering
   * at resizeLiveW/H until the store re-renders — same no-flicker pattern
   * used for drag.
   */
  const handleResizeEnd = useCallback((id: string, width: number, height: number) => {
    resizeNode(id, width, height);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [resizeNode]);

  const handleCollapseDirTap = useCallback((nodeId: string, dir: string) => {
    toggleCollapseDir(nodeId, dir);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [toggleCollapseDir]);

  const callbacks = useMemo(() => ({
    onNodeTap: handleNodeTap,
    onNodeDoubleTap: handleDoubleTap,
    onBackgroundTap: handleBackgroundTap,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onResizeEnd: handleResizeEnd,
    onCollapseDirTap: handleCollapseDirTap,
  }), [handleNodeTap, handleDoubleTap, handleBackgroundTap, handleDragStart, handleDragEnd, handleResizeEnd, handleCollapseDirTap]);

  const { gesture, transform, dragState, resizeState, forceClearDrag } =
    useMapGestures(layoutNodes, callbacks);

  const saveEdit = useCallback(() => {
    if (selectedId && editText.trim()) {
      updateNodeTitle(selectedId, editText.trim());
    }
    setIsEditTopicVisible(false);
  }, [selectedId, editText, updateNodeTitle]);

  // renderBackdrop removed, handled by BottomSheet component

  const handleAddChild = useCallback(() => {
    if (isEditTopicVisible) {
      saveEdit();
    }
    const parentId = selectedId || rootId;
    if (!parentId) return;
    addNode(parentId, 'Novo tópico');
    // Clear parent's directional collapses so new child is visible
    const parent = nodes.find((n) => n.id === parentId);
    if (parent?.collapsed) toggleCollapse(parentId);
    if (parent?.collapsedDirs && parent.collapsedDirs.length > 0) {
      for (const dir of parent.collapsedDirs) {
        toggleCollapseDir(parentId, dir);
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [selectedId, rootId, addNode, nodes, toggleCollapse, toggleCollapseDir, isEditTopicVisible, saveEdit]);

  const handleDelete = useCallback(() => {
    if (!selectedId || selectedId === rootId) return;
    setIsEditTopicVisible(false);
    deleteNode(selectedId);
    forceClearDrag();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [selectedId, rootId, deleteNode, forceClearDrag]);

  const handleZoomToFit = useCallback(() => {
    if (layoutNodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of layoutNodes) {
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width); maxY = Math.max(maxY, n.y + n.height);
    }
    const PAD = 60;
    const contentW = maxX - minX + PAD * 2;
    const contentH = maxY - minY + PAD * 2;
    const viewW = SCREEN_W;
    const viewH = SCREEN_H - insets.top - insets.bottom - 120;
    const newScale = Math.min(viewW / contentW, viewH / contentH, 1.2);
    transform.scale.value = newScale;
    transform.translateX.value = viewW / 2 - (minX - PAD + contentW / 2) * newScale;
    transform.translateY.value = viewH / 2 - (minY - PAD + contentH / 2) * newScale;
  }, [layoutNodes, transform, insets, SCREEN_W, SCREEN_H]);

  const handleAIGenerate = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    setIsEditTopicVisible(false);
    setIsGenerating(true);
    setIsAiModalVisible(false);

    try {
      const result = await aiService.processJSON(aiPrompt.trim(), 'generate_mindmap', PRESET_COLORS);

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

      if (!validateMindMapJSON(result.data)) {
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

      const { nodes: newNodes, rootId: newRootId } = convertMindMapJSON(result.data);
      hasTypedMapText.current = true;
      useMindMapStore.getState().setWholeState({
        nodes: newNodes,
        rootId: newRootId,
        selectedId: newRootId,
      });

      setAiPrompt('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Center the generated map
      requestAnimationFrame(() => {
        handleZoomToFit();
      });
    } catch (error) {
      console.error('AI Mind Map Error:', error);
      dialog.show({
        title: 'Erro',
        description: 'Ocorreu um erro ao gerar o mapa mental.',
        variant: 'error',
        buttons: [{ text: 'OK', variant: 'default' }],
      });
    } finally {
      setIsGenerating(false);
    }
  }, [aiPrompt, convertMindMapJSON, dialog, handleZoomToFit]);

  // Center on load for existing tasks
  useEffect(() => {
    if (!isLoadingMap && nodes.length > 0 && (taskId || mapSession || template || savedMapId) && !hasCenteredOnLoad.current) {
      hasCenteredOnLoad.current = true;
      // Give layout memo a chance to update
      requestAnimationFrame(() => {
        handleZoomToFit();
      });
    }
  }, [nodes, taskId, mapSession, template, savedMapId, isLoadingMap, handleZoomToFit]);

  const selectedNode = layoutNodes.find((n) => n.id === selectedId);


  // If loading a map from DB and nodes array is not hydrated yet or creating new
  if (isLoadingMap) return <View className="flex-1 bg-surface items-center justify-center"><ActivityIndicator color={primaryColor} /></View>;

  if (nodes.length === 0) {
    return (
      <View style={{ paddingTop: insets.top }} className="flex-1 bg-surface">
        <View className="flex-row items-center border-b border-border/10 px-4 pb-4 pt-2">
          <TouchableOpacity activeOpacity={0.8} onPress={handleBack} className="mr-3 p-2 -ml-2">
            <ChevronLeft size={28} color={isDark ? '#FFFFFF' : '#000000'} />
          </TouchableOpacity>
          <View>
            <Text className="font-sans-semibold text-xl text-on-surface">Mapa Mental</Text>
            {(savedMapId !== null || autosaveStatus !== 'saved') && <Text className="font-sans text-[10px]" style={{ color: autosaveStatus === 'error' ? '#EF4444' : isDark ? '#A1A1AA' : '#71717A' }}>
              {autosaveStatus === 'error' ? 'Não foi possível salvar' : autosaveStatus === 'empty' ? 'Mapa vazio — não salvo' : autosaveStatus === 'saved' ? 'Salvo automaticamente' : 'Salvando…'}
            </Text>}
          </View>
        </View>
        <View className="flex-1 justify-center items-center px-8">
          <View 
            style={{ backgroundColor: withOpacity("#10B981", isDark ? 0.15 : 0.1) }}
            className="mb-8 h-24 w-24 items-center justify-center rounded-full"
          >
            <Network size={48} color="#10B981" />
          </View>
           <Text className="font-sans-semibold text-xl text-on-surface text-center mb-2">
             Mapa Mental
           </Text>
           <Text className="font-sans text-base text-on-surface-secondary text-center mb-10">
             Crie mapas mentais interativos para organizar suas ideias, estudos ou projetos de forma visual.
           </Text>

           <ToolActions>
             <ToolActions.Button
               onPress={() => {
                 initRoot('Ideia Central');
                 requestAnimationFrame(() => {
                   transform.translateX.value = SCREEN_W / 2 - NODE_DEFAULT_WIDTH / 2;
                   transform.translateY.value = SCREEN_H / 2 - NODE_DEFAULT_HEIGHT / 2 - 60;
                 });
                 Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
               }}
               icon={<Network size={24} color="#10B981" />}
               color="#10B981"
               title="Criar Mapa Mental"
               description="Começar do zero"
             />
             <ToolActions.Button
               onPress={() => {
                 setIsAiModalVisible(true);
                 Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
               }}
               icon={<Sparkles size={24} color={primaryColor} />}
               color={primaryColor}
               title="Gerar com IA"
               description="Criar usando inteligência artificial"
             />
           </ToolActions>
        </View>

        {/* AI Generation Overlay (Not a Modal to fix Android keyboard) */}
        {isAiModalVisible && (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="absolute inset-0 z-[100] justify-end"
            style={[{ backgroundColor: 'rgba(0,0,0,0.6)' }]}
          >
            <TouchableOpacity 
              style={{ flex: 1 }} 
              activeOpacity={1} 
              onPress={() => setIsAiModalVisible(false)} 
            />
            <View className="p-6 gap-4 rounded-t-3xl" style={{ backgroundColor: isDark ? '#18181b' : '#f4f4f5', paddingBottom: Math.max(insets.bottom, 24) }}>
              <View className="flex-row items-center gap-3 mb-1">
                <View className="h-10 w-10 rounded-full items-center justify-center" style={{ backgroundColor: withOpacity(primaryColor, 0.08) }}>
                  <Sparkles size={20} color={primaryColor} />
                </View>
                <View className="flex-1">
                  <Text className="font-sans-bold text-xl text-on-surface">Gerar com IA</Text>
                  <Text className="font-sans text-xs text-on-surface-secondary">Descreva o tema para criar um mapa mental</Text>
                </View>
              </View>
              <TextInput
                value={aiPrompt}
                onChangeText={setAiPrompt}
                placeholder="Ex: Fotossíntese, Sistema Solar, Marketing Digital..."
                placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoFocus
                style={[
                  {
                    borderWidth: 1, borderRadius: 14, padding: 16, fontSize: 16,
                    backgroundColor: isDark ? '#27272A' : '#FFFFFF',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    color: isDark ? '#FAFAFA' : '#18181B',
                    minHeight: 100,
                    fontFamily: 'Montserrat-Regular',
                  },
                ]}
              />
              <Button
                size="lg"
                onPress={handleAIGenerate}
                disabled={!aiPrompt.trim() || isGenerating}
                loading={isGenerating}
                className="mt-2"
              >
                {!isGenerating && <Button.Icon icon={Sparkles} />}
                <Button.Text>{isGenerating ? 'Gerando...' : 'Gerar Mapa Mental'}</Button.Text>
              </Button>
            </View>
          </KeyboardAvoidingView>
        )}

        {/* Overlay Loading */}
        <LoadingOverlay visible={isGenerating} title="Gerando mapa com IA..." />
      </View>
    );
  }

  return (
    <View style={{ paddingTop: insets.top }} className="flex-1 bg-surface">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border/10 px-4 pb-3 pt-2">
        <View className="flex-row items-center">
          <TouchableOpacity activeOpacity={0.8} onPress={handleBack} className="mr-3 p-2 -ml-2">
            <ChevronLeft size={28} color={isDark ? '#FFFFFF' : '#000000'} />
          </TouchableOpacity>
          <View>
            <Text className="font-sans-semibold text-xl text-on-surface">Mapa Mental</Text>
            {(savedMapId !== null || autosaveStatus !== 'saved') && <Text className="font-sans text-[10px]" style={{ color: autosaveStatus === 'error' ? '#EF4444' : isDark ? '#A1A1AA' : '#71717A' }}>
              {autosaveStatus === 'error' ? 'Não foi possível salvar' : autosaveStatus === 'empty' ? 'Mapa vazio — não salvo' : autosaveStatus === 'saved' ? 'Salvo automaticamente' : 'Salvando…'}
            </Text>}
          </View>
        </View>
        <View className="flex-row items-center gap-1">
           <TouchableOpacity
           activeOpacity={0.8}
             onPress={() => {
               setIsAiModalVisible(true);
               Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
             }}
             className="p-2"
           >
             <Sparkles size={22} color={primaryColor} />
           </TouchableOpacity>
           <TouchableOpacity activeOpacity={0.8} onPress={handleZoomToFit} className="p-2">
            <Maximize size={22} color={isDark ? '#D4D4D8' : '#52525B'} />
          </TouchableOpacity>
          <TouchableOpacity
          activeOpacity={0.8}
            onPress={() => {
              const allCollapsed = nodes.every(
                (n) => {
                  const hasChildren = nodes.some((c) => c.parentId === n.id);
                  if (!hasChildren) return true;
                  return n.collapsed || (n.collapsedDirs && n.collapsedDirs.length > 0);
                },
              );
              if (allCollapsed) expandAll(); else collapseAll();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className="p-2"
          >
            <Expand size={22} color={isDark ? '#D4D4D8' : '#52525B'} />
          </TouchableOpacity>
          <TouchableOpacity
          activeOpacity={0.8}
            onPress={() => {
              if (isEditTopicVisible) {
                if (selectedId && editText.trim()) {
                  updateNodeTitle(selectedId, editText.trim());
                }
                setIsEditTopicVisible(false);
                Keyboard.dismiss();
              }
              exportSheetRef.current?.present();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className="p-2"
          >
            <Download size={22} color={isDark ? '#D4D4D8' : '#52525B'} />
          </TouchableOpacity>
        </View>
      </View>
 
      <View className="flex-1 relative">
        <GestureDetector gesture={gesture}>
          <View className="flex-1 overflow-hidden">
            <MindMapCanvas
              nodes={layoutNodes}
              selectedId={selectedId}
              editingId={isEditTopicVisible ? selectedId : null}
              translateX={transform.translateX}
              translateY={transform.translateY}
              scale={transform.scale}
              primaryColor={primaryColor}
              isDark={isDark}
              dragState={dragState}
              resizeState={resizeState}
              childDirsMap={childDirsMap}
              hiddenNodes={hiddenNodes}
              canvasBgColor={canvasBgColor}
              bgPattern={bgPattern}
            />
          </View>
        </GestureDetector>

        {/* Inline Editor Overlay */}
        {isEditTopicVisible && selectedNode && (
          <InlineNodeEditor
              node={selectedNode}
              text={editText}
              onTextChange={(text) => {
                setEditText(text);
                if (selectedId) {
                  hasTypedMapText.current = true;
                  updateNodeTitle(selectedId, text);
                }
              }}
              onSave={saveEdit}
              transform={transform}
              isDark={isDark}
          />
        )}
      </View>

      {/* FABs */}
      <View className="absolute right-5 flex-col gap-3 items-center" style={[{ bottom: Math.max(insets.bottom, 16) + 16 }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            bgSheetRef.current?.present();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          className="w-[52px] h-[52px] rounded-2xl items-center justify-center"
          style={[{
            backgroundColor: isDark ? '#27272A' : '#F4F4F5',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          }, shadows.sm]}
        >
          <Settings size={22} color={isDark ? '#D4D4D8' : '#52525B'} />
        </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleAddChild}
            className="w-[52px] h-[52px] rounded-2xl items-center justify-center"
            style={[{ backgroundColor: primaryColor }, shadows.sm]}
          >
            <Plus size={22} color="#FFF" />
          </TouchableOpacity>

        {selectedNode ? (
          <>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => selectedId && openEditSheet(selectedId)}
              className="w-[52px] h-[52px] rounded-2xl items-center justify-center"
              style={[{
                backgroundColor: isDark ? '#27272A' : '#F4F4F5',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              }, shadows.sm]}
            >
              <Type size={20} color={isDark ? '#E4E4E7' : '#3F3F46'} />
            </TouchableOpacity>

            {selectedId !== rootId && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleDelete}
                className="w-[52px] h-[52px] rounded-2xl items-center justify-center"
                style={[{
                  backgroundColor: isDark ? '#27272A' : '#F4F4F5',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                }, shadows.sm]}
              >
                <Trash2 size={24} color={isDark ? '#E4E4E7' : '#3F3F46'} />
              </TouchableOpacity>
            )}
          </>
        ) : (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              dialog.show({
                title: 'Apagar tudo?',
                description: 'Isso removerá todos os tópicos do mapa mental. Deseja continuar?',
                variant: 'error',
                buttons: [
                  { text: 'Cancelar', variant: 'ghost' },
                  {
                    text: 'Apagar',
                    variant: 'default',
                    onPress: () => {
                      if (rootId) {
                        const store = useMindMapStore.getState();
                        store.nodes.forEach(n => {
                          if (n.id !== rootId) store.deleteNode(n.id);
                        });
                        store.updateNodeTitle(rootId, 'Ideia Central');
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      }
                    },
                  },
                ],
              });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            className="w-[52px] h-[52px] rounded-2xl items-center justify-center"
            style={[{
              backgroundColor: isDark ? '#27272A' : '#F4F4F5',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            }, shadows.sm]}
          >
            <Trash2 size={24} color={isDark ? '#E4E4E7' : '#3F3F46'} />
          </TouchableOpacity>
        )}
      </View>

      {/* Info bar */}
      {selectedNode && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            colorSheetRef.current?.present();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          className="absolute left-5 right-24 flex-row items-center px-4 py-3 rounded-2xl border"
          style={[
            {
              bottom: Math.max(insets.bottom, 16) + 16,
              backgroundColor: isDark ? '#18181B' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            },
            shadows.sm,
          ]}
        >
          <View style={[
            { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
            { backgroundColor: selectedNode.color || (selectedNode.depth === 0 ? (isDark ? '#2563EB' : '#3B82F6') : selectedNode.depth === 1 ? (isDark ? '#1E293B' : '#F0F4FF') : (isDark ? '#1A1A2E' : '#FAFBFF')) },
            { borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }
          ]} />
          <Text className="font-sans-medium text-sm text-on-surface flex-1" numberOfLines={1}>
            {selectedNode.title}
          </Text>
          <Palette size={16} color={isDark ? '#71717A' : '#A1A1AA'} style={{ marginLeft: 6 }} />
          <Text className="font-sans text-xs text-on-surface-secondary ml-2">
            Nível {selectedNode.depth}
          </Text>
        </TouchableOpacity>
      )}

      {/* Edit Overlay removed - replaced by InlineNodeEditor */}

      {/* AI Generation Overlay (Not a Modal to fix Android keyboard) */}
      {isAiModalVisible && (
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="absolute inset-0 justify-end z-[100]"
          style={[{ backgroundColor: 'rgba(0,0,0,0.6)' }]}
        >
          <TouchableOpacity 
            style={{ flex: 1 }} 
            activeOpacity={1} 
            onPress={() => setIsAiModalVisible(false)} 
          />
          <View className="p-6 gap-4 rounded-t-3xl" style={{ backgroundColor: isDark ? '#18181b' : '#f4f4f5', paddingBottom: Math.max(insets.bottom, 24) }}>
            <View className="flex-row items-center gap-3 mb-1">
              <View className="h-10 w-10 rounded-full items-center justify-center" style={{ backgroundColor: withOpacity(primaryColor, 0.08) }}>
                <Sparkles size={20} color={primaryColor} />
              </View>
              <View className="flex-1">
                <Text className="font-sans-bold text-xl text-on-surface">Gerar com IA</Text>
                <Text className="font-sans text-xs text-on-surface-secondary">Descreva o tema para criar um mapa mental</Text>
              </View>
            </View>
            <TextInput
              value={aiPrompt}
              onChangeText={setAiPrompt}
              placeholder="Ex: Fotossíntese, Sistema Solar, Marketing Digital..."
              placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
              style={[
                {
                  borderWidth: 1, borderRadius: 14, padding: 16, fontSize: 16,
                  backgroundColor: isDark ? '#27272A' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  color: isDark ? '#FAFAFA' : '#18181B',
                  minHeight: 100,
                  fontFamily: 'Montserrat-Regular',
                },
              ]}
            />
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleAIGenerate}
              disabled={!aiPrompt.trim() || isGenerating}
              className="rounded-2xl py-4 items-center justify-center flex-row gap-2"
              style={{ backgroundColor: primaryColor, opacity: (!aiPrompt.trim() || isGenerating) ? 0.5 : 1 }}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Sparkles size={18} color="#FFF" />
              )}
              <Text className="font-sans-bold text-white text-base">{isGenerating ? 'Gerando...' : 'Gerar Mapa Mental'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Color picker bottom sheet */}
      <BottomSheet
        sheetRef={colorSheetRef}
        snapPoints={colorSnapPoints}
      >
        <BottomSheet.View>
          <BottomSheet.Header 
            title="Cor do Nó" 
            subtitle="Escolha uma cor de fundo para este tópico." 
          />
          <ColorPicker
            selectedColor={selectedNode?.color || ''}
            onSelect={(color) => {
              if (selectedId) {
                setNodeColor(selectedId, color);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
            isDark={isDark}
            colors={['#3B82F6', '#6a57e3', '#22c55e', '#f97316', '#ec4899', '#ef4444', '#14b8a6', '#eab308', '#64748B', '#8B5CF6']}
          />

          <BottomSheet.Header 
            title="Alinhamento" 
            subtitle="Escolha como o texto deve ser alinhado no nó." 
          />
          <View className="flex-row gap-3">
            {[
              { id: 'left', icon: AlignLeft, label: 'Esquerda' },
              { id: 'center', icon: AlignCenter, label: 'Centro' },
              { id: 'right', icon: AlignRight, label: 'Direita' }
            ].map((align) => {
              const isSelected = (selectedNode?.textAlign || 'center') === align.id;
              const Icon = align.icon;
              return (
                <TouchableOpacity
                  key={align.id}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (selectedId) {
                      setTextAlign(selectedId, align.id as any);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                  className={`flex-1 flex-row py-3 items-center justify-center rounded-xl border ${isSelected ? 'border-primary bg-primary/10' : 'border-border bg-surface-secondary'}`}
                >
                  <Icon size={18} color={isSelected ? primaryColor : (isDark ? '#A1A1AA' : '#71717A')} />
                  <Text className={`ml-2 font-sans-medium text-xs ${isSelected ? 'text-primary' : 'text-on-surface-secondary'}`}>
                    {align.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <BottomSheet.Header 
            title="Imagem" 
            subtitle="Adicione uma imagem para ilustrar este tópico." 
          />
          <View className="flex-row gap-3">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={pickImage}
              className="flex-1 flex-row py-3 items-center justify-center rounded-xl border border-border bg-surface-secondary"
            >
              <ImageIcon size={18} color={isDark ? '#A1A1AA' : '#71717A'} />
              <Text className="ml-2 font-sans-medium text-xs text-on-surface-secondary">
                {selectedNode?.imageUri ? 'Trocar Imagem' : 'Adicionar Imagem'}
              </Text>
            </TouchableOpacity>
            
            {selectedNode?.imageUri && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  if (selectedId) {
                    setNodeImage(selectedId, null);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                className="flex-row px-4 py-3 items-center justify-center rounded-xl border border-border bg-surface-secondary"
              >
                <Trash2 size={18} color={isDark ? '#A1A1AA' : '#71717A'} />
              </TouchableOpacity>
            )}
          </View>
        </BottomSheet.View>
      </BottomSheet>

      {/* Background Settings bottom sheet */}
      <BottomSheet
        sheetRef={bgSheetRef}
        snapPoints={bgSnapPoints}
      >
        <BottomSheet.View className="gap-6">
          <BottomSheet.Header 
            title="Fundo do Mapa" 
            subtitle="Personalize a cor e o padrão do fundo." 
          />
          
          <View>
            <Text className="font-sans-semibold text-sm text-on-surface mb-3">Padrão</Text>
            <View className="flex-row gap-3">
              {(['none', 'grid', 'dots', 'lines'] as const).map(pattern => {
                const isSelected = bgPattern === pattern;
                return (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    key={pattern}
                    onPress={() => { setBgPattern(pattern); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    className={`flex-1 py-3 items-center justify-center rounded-xl border ${isSelected ? 'border-primary bg-primary/10' : 'border-border bg-surface-secondary'}`}
                  >
                    <Text className={`font-sans-medium text-xs ${isSelected ? 'text-primary' : 'text-on-surface-secondary'}`}>
                      {pattern === 'none' ? 'Nenhum' : pattern === 'grid' ? 'Grade' : pattern === 'dots' ? 'Pontos' : 'Linhas'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View>
            <Text className="font-sans-semibold text-sm text-on-surface mb-3">Cor de Fundo</Text>
            <ColorPicker
              selectedColor={canvasBgColor || (isDark ? '#09090B' : '#FAFAFA')}
              onSelect={(color) => {
                setCanvasBgColor(color);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              isDark={isDark}
              colors={['#FAFAFA', '#09090B', '#1E293B', '#FFFBF0', '#F0F9FF', '#0F172A', '#FEE2E2', '#E0E7FF']}
            />
          </View>
        </BottomSheet.View>
      </BottomSheet>

      {/* Export Options bottom sheet */}
      <BottomSheet
        sheetRef={exportSheetRef}
        snapPoints={exportSnapPoints}
      >
        <BottomSheet.View>
          <BottomSheet.Header title="Opções" />

          <BottomSheet.ItemGroup>
            {savedMapId ? (
              <>
                <BottomSheet.Item
                  icon={<Network size={18} color={primaryColor} />}
                  iconBackgroundColor="rgba(139,92,246,0.15)"
                  title="Atualizar mapa existente"
                  onPress={() => handleSaveToDatabase(false)}
                />
                <BottomSheet.Separator />
                <BottomSheet.Item
                  icon={<Network size={18} color={primaryColor} />}
                  iconBackgroundColor="rgba(139,92,246,0.15)"
                  title="Salvar como novo Mapa"
                  onPress={() => handleSaveToDatabase(true)}
                />
              </>
            ) : (
              <BottomSheet.Item
                icon={<Network size={18} color={primaryColor} />}
                iconBackgroundColor="rgba(139,92,246,0.15)"
                title="Salvar no grupo Mapas Mentais"
                onPress={() => handleSaveToDatabase(false)}
              />
            )}
            <BottomSheet.Separator />
            <BottomSheet.Item
              icon={<Share2 size={20} color="#3B82F6" />}
              iconBackgroundColor="rgba(59,130,246,0.1)"
              title="Compartilhar Imagem"
              onPress={handleShareImage}
            />
            <BottomSheet.Separator />
            <BottomSheet.Item
              icon={<Download size={20} color="#3B82F6" />}
              iconBackgroundColor="rgba(59,130,246,0.1)"
              title="Salvar na Galeria"
              onPress={handleSaveImage}
            />
          </BottomSheet.ItemGroup>
        </BottomSheet.View>
      </BottomSheet>



      {/* Overlay Loading */}
      {isExporting && (
        <View className="absolute z-50 top-0 left-0 right-0 bottom-0 bg-black/60 items-center justify-center">
          <View className="bg-surface p-6 rounded-2xl items-center" style={shadows.lg}>
            <ActivityIndicator size="large" color={primaryColor} />
            <Text className="font-sans-semibold mt-4 text-on-surface text-base">Processando...</Text>
          </View>
        </View>
      )}

      {/* Overlay Loading for AI */}
      <LoadingOverlay visible={isGenerating} title="Gerando mapa com IA..." />
    </View>
  );
}
