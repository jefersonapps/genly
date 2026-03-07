import { useDialog } from "@/providers/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { withOpacity } from "@/utils/colors";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  CheckCircle2,
  ChevronLeft,
  Circle,
  Download,
  FilePlus2,
  FileText,
  Plus,
  Share2
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";
import PdfThumbnail from "react-native-pdf-thumbnail";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const COLUMN_COUNT = 2;

type PDFImageItem = {
  id: string;
  uri: string;
  pageIndex: number;
};

export default function PdfToImageScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ fileUri?: string }>();
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === "dark";
  const dialog = useDialog();

  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [images, setImages] = useState<PDFImageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const ITEM_WIDTH = (SCREEN_WIDTH - 48) / COLUMN_COUNT;

  // Load PDF if passed via route params
  useEffect(() => {
    if (params.fileUri) {
      setPdfUri(params.fileUri);
      processPdf(params.fileUri);
    }
  }, [params.fileUri]);

  const processPdf = async (uri: string) => {
    setIsProcessing(true);
    try {
      const result = await PdfThumbnail.generateAllPages(uri, 90);
      const newImages: PDFImageItem[] = result.map((res, i) => ({
        id: `page-${i}-${Date.now()}`,
        uri: res.uri,
        pageIndex: i,
      }));
      setImages(newImages);
      // Select all by default
      setSelectedIds(new Set(newImages.map(img => img.id)));
    } catch (error) {
      console.error("Error processing PDF:", error);
      dialog.show({
        title: "Erro",
        description: "Não foi possível carregar as páginas do PDF.",
        buttons: [{ text: "OK" }],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setPdfUri(uri);
        processPdf(uri);
      }
    } catch (err) {
      console.error("Error picking document:", err);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const getSelectedUris = () => {
    return images.filter(img => selectedIds.has(img.id)).map(img => img.uri);
  };

  const handleSaveToGallery = async () => {
    const uris = getSelectedUris();
    if (uris.length === 0) return;

    setIsProcessing(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        dialog.show({
          title: "Permissão Negada",
          description: "Precisamos de permissão para salvar imagens na galeria.",
          buttons: [{ text: "OK" }],
        });
        return;
      }

      for (const uri of uris) {
        await MediaLibrary.saveToLibraryAsync(uri);
      }

      dialog.show({
        title: "Sucesso",
        description: `${uris.length} imagem(ns) salva(s) na galeria com sucesso.`,
        buttons: [{ text: "OK" }],
      });
    } catch (error) {
      console.error("Error saving to gallery:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShareBatch = async () => {
    const uris = getSelectedUris();
    if (uris.length === 0) return;

    try {
       if (Platform.OS === 'android') {
          // react-native-share is better for batch sharing on android
          const Share = require('react-native-share').default;
          await Share.open({
            urls: uris,
            type: 'image/jpeg',
          });
       } else {
          await Sharing.shareAsync(uris[0]); // Sharing only supports one on iOS natively via this expo lib
       }
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        console.error("Error sharing:", error);
      }
    }
  };

  const handleCreateNote = () => {
    const uris = getSelectedUris();
    if (uris.length === 0) return;

    router.push({
      pathname: "/task/editor",
      params: {
        sharedImages: JSON.stringify(uris),
      }
    });
  };

  const renderItem = ({ item }: { item: PDFImageItem }) => {
    const isSelected = selectedIds.has(item.id);

    return (
      <TouchableOpacity
        onPress={() => toggleSelection(item.id)}
        activeOpacity={0.8}
        style={[styles.itemContainer, { backgroundColor: isDark ? "#1A1A1A" : "#F5F5F5", width: ITEM_WIDTH, height: ITEM_WIDTH * 1.4 }]}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.thumbnail}
          contentFit="contain"
        />
        <View style={styles.pageBadge}>
          <Text style={styles.pageBadgeText}>Pág. {item.pageIndex + 1}</Text>
        </View>
        <View style={styles.selectionOverlay}>
            {isSelected ? (
                <CheckCircle2 size={24} color={primaryColor} fill={withOpacity(primaryColor, 0.2)} />
            ) : (
                <Circle size={24} color={isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)"} />
            )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-outline/10">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface-secondary/50"
        >
          <ChevronLeft size={24} color={isDark ? "#FFF" : "#000"} />
        </TouchableOpacity>
        <Text className="font-sans-bold text-lg text-on-surface">PDF para Imagem</Text>
        <View className="w-10" />
      </View>

      {!pdfUri ? (
        <View className="flex-1 justify-center items-center px-8">
           <View className={`mb-6 h-24 w-24 items-center justify-center rounded-full ${isDark ? "bg-primary/20" : "bg-primary/10"}`}>
             <FileText size={48} color={primaryColor} />
           </View>
           <Text className="font-sans-semibold text-xl text-on-surface text-center mb-2">
             Selecione um PDF
           </Text>
           <Text className="font-sans text-base text-on-surface-secondary text-center mb-8">
             Escolha um arquivo para extrair suas páginas como imagens individuais.
           </Text>
           <TouchableOpacity
             onPress={handlePickDocument}
             className="rounded-full px-8 py-4 gap-2 items-center justify-center flex-row"
             style={{ backgroundColor: primaryColor }}
           >
             <Plus size={20} color="#FFFFFF" className="mr-2" />
             <Text className="font-sans-bold text-white text-base">Escolher Arquivo</Text>
           </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-1">
          {isProcessing ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={primaryColor} />
              <Text className="mt-4 font-sans text-on-surface-secondary">Processando PDF...</Text>
            </View>
          ) : (
            <>
              <FlatList
                data={images}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                numColumns={COLUMN_COUNT}
                contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120 }}
                showsVerticalScrollIndicator={false}
              />

              {/* Action Bar */}
              <View 
                style={[
                    styles.actionBar, 
                    { 
                        backgroundColor: isDark ? "#121212" : "#FFFFFF",
                        paddingBottom: insets.bottom + 16,
                        borderTopColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"
                    }
                ]}
              >
                <View className="mb-4 flex-row items-center justify-between px-4">
                    <Text className="font-sans text-on-surface-secondary">
                        {selectedIds.size} de {images.length} selecionadas
                    </Text>
                    <TouchableOpacity 
                        onPress={() => setSelectedIds(selectedIds.size === images.length ? new Set() : new Set(images.map(i => i.id)))}
                    >
                        <Text style={{ color: primaryColor }} className="font-sans-bold">
                            {selectedIds.size === images.length ? "Desmarcar todas" : "Selecionar todas"}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View className="flex-row gap-2 px-4">
                  <TouchableOpacity
                    onPress={handleSaveToGallery}
                    disabled={selectedIds.size === 0}
                    style={[styles.actionButton, { backgroundColor: isDark ? "#2A2A2A" : "#F0F0F0", opacity: selectedIds.size === 0 ? 0.5 : 1 }]}
                  >
                    <Download size={20} color={isDark ? "#FFF" : "#000"} />
                    <Text style={{ color: isDark ? "#FFF" : "#000" }} className="mt-1 text-xs font-sans-medium">Galeria</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleShareBatch}
                    disabled={selectedIds.size === 0}
                    style={[styles.actionButton, { backgroundColor: isDark ? "#2A2A2A" : "#F0F0F0", opacity: selectedIds.size === 0 ? 0.5 : 1 }]}
                  >
                    <Share2 size={20} color={isDark ? "#FFF" : "#000"} />
                    <Text style={{ color: isDark ? "#FFF" : "#000" }} className="mt-1 text-xs font-sans-medium">Compartilhar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleCreateNote}
                    disabled={selectedIds.size === 0}
                    style={[styles.actionButton, { backgroundColor: primaryColor, opacity: selectedIds.size === 0 ? 0.5 : 1 }]}
                  >
                    <FilePlus2 size={20} color="#FFF" />
                    <Text className="mt-1 text-xs font-sans-medium text-white">Nota</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  itemContainer: {
    margin: 8,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  thumbnail: {
    flex: 1,
    margin: 12,
  },
  pageBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pageBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontFamily: "Montserrat-Medium",
  },
  selectionOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  }
});
