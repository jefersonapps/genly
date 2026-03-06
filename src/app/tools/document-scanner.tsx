import { Button } from "@/components/ui/Button";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useDialog } from "@/providers/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { withOpacity } from "@/utils/colors";
import { recognizeText, sanitizeForWinAnsi } from "@/utils/ocr";
import { launchScanner } from "@dariyd/react-native-document-scanner";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  Camera,
  Check,
  ChevronLeft,
  Download,
  FilePlus2,
  Languages,
  Plus,
  RotateCw,
  Share2,
  Trash2,
  X
} from "lucide-react-native";
import { PDFDocument, degrees, rgb } from "pdf-lib";
import React, { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RNShare from "react-native-share";
import Sortable from "react-native-sortables";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export type ScannedPageItem = {
  id: string;
  uri: string;
  rotation: number;
};

export default function DocumentScannerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ imageUris?: string }>();
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === "dark";
  const dialog = useDialog();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const [pages, setPages] = useState<ScannedPageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOCREnabled, setIsOCREnabled] = useState(false);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const snapPoints = React.useMemo(() => ["55%"], []);

  React.useEffect(() => {
    if (params.imageUris) {
      try {
        const uris: string[] = JSON.parse(params.imageUris);
        if (uris.length > 0) {
          const newItems: ScannedPageItem[] = uris.map((uri) => ({
            id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
            uri,
            rotation: 0,
          }));
          setPages(newItems);
        }
      } catch (e) {
        console.error("Error parsing imageUris in DocumentScanner:", e);
      }
    }
  }, [params.imageUris]);

  const handleScan = async (insertIndex?: number) => {
    try {
      const result = await launchScanner({
        quality: 1,
        includeBase64: false,
      });

      if (result.didCancel) return;
      if (result.error) {
        dialog.show({ title: "Erro", description: result.errorMessage || "Ocorreu um erro ao escanear." });
        return;
      }

      if (result.images && result.images.length > 0) {
        const newItems: ScannedPageItem[] = result.images.map((img) => ({
          id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
          uri: img.uri,
          rotation: 0,
        }));

        setPages((prev) => {
          const updated = [...prev];
          if (
            typeof insertIndex === "number" &&
            insertIndex >= 0 &&
            insertIndex <= updated.length
          ) {
            updated.splice(insertIndex, 0, ...newItems);
          } else {
            updated.push(...newItems);
          }
          return updated;
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Scanner Error:", error);
      dialog.show({ title: "Erro", description: "Não foi possível abrir o scanner." });
    }
  };

  const removePage = (id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const rotatePage = (id: string) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p
      )
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleCreateNote = () => {
    bottomSheetModalRef.current?.dismiss();
    if (pages.length === 0) {
      dialog.show({ title: "Aviso", description: "Escaneie pelo menos um documento primeiro." });
      return;
    }
    const uris = pages.map((p) => p.uri);
    router.push({
      pathname: "/task/editor",
      params: { sharedImages: JSON.stringify(uris) },
    });
  };

  const generatePDFBase64 = async (): Promise<string | null> => {
    if (pages.length === 0) return null;
    try {
      setIsProcessing(true);
      const mergedPdf = await PDFDocument.create();

      for (const pageItem of pages) {
        const imgData = await FileSystem.readAsStringAsync(pageItem.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const embeddedImage = await mergedPdf.embedJpg(`data:image/jpeg;base64,${imgData}`);
        const imgWidth = embeddedImage.width;
        const imgHeight = embeddedImage.height;
        const page = mergedPdf.addPage([imgWidth, imgHeight]);

        // 1. Draw Text Layer (if OCR is enabled)
        if (isOCREnabled) {
          const ocrData = await recognizeText(pageItem.uri);
          if (ocrData) {
            for (const block of ocrData.blocks) {
              for (const line of block.lines) {
                // Use elements (words) for better selection precision
                for (const element of line.elements) {
                  const { frame } = element;
                  if (!frame) continue;
                  
                  const pdfX = frame.left;
                  const pdfY = imgHeight - frame.top - frame.height;
                  
                  const sanitizedText = sanitizeForWinAnsi(element.text);
                  if (!sanitizedText) continue;

                  page.drawText(sanitizedText, {
                    x: pdfX,
                    y: pdfY,
                    size: frame.height, // Use exact height for precision
                    color: rgb(0, 0, 0),
                    opacity: 0,
                  });
                }
              }
            }
          }
        }

        // 2. Draw Image Layer (on top of text)
        if (pageItem.rotation !== 0) {
          page.setRotation(degrees(pageItem.rotation));
        }

        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: imgWidth,
          height: imgHeight,
        });
      }

      return await mergedPdf.saveAsBase64({ dataUri: false });
    } catch (error) {
      console.error("Error generating PDF:", error);
      dialog.show({ title: "Erro", description: "Ocorreu um erro ao gerar o PDF." });
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSavePDF = async () => {
    bottomSheetModalRef.current?.dismiss();
    const base64Data = await generatePDFBase64();
    if (!base64Data) return;
    try {
      if (Platform.OS === "android") {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const uri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            `documento-${Date.now()}.pdf`,
            "application/pdf"
          );
          await FileSystem.writeAsStringAsync(uri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          dialog.show({ title: "Sucesso", description: "PDF salvo com sucesso." });
        }
      } else {
        const fileUri = `${FileSystem.cacheDirectory}documento-${Date.now()}.pdf`;
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await Sharing.shareAsync(fileUri, { UTI: "com.adobe.pdf" });
      }
    } catch (error) {
      console.error("Error saving PDF:", error);
      dialog.show({ title: "Erro", description: "Falha ao salvar o PDF." });
    }
  };

  const handleSharePDF = async () => {
    bottomSheetModalRef.current?.dismiss();
    const base64Data = await generatePDFBase64();
    if (!base64Data) return;
    try {
      const fileUri = `${FileSystem.cacheDirectory}documento-${Date.now()}.pdf`;
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/pdf",
        dialogTitle: "Compartilhar Documento Escaneado",
      });
    } catch (error) {
      console.error("Error sharing PDF:", error);
      dialog.show({ title: "Erro", description: "Falha ao compartilhar o PDF." });
    }
  };

  const handleSaveGallery = async () => {
    bottomSheetModalRef.current?.dismiss();
    try {
      setIsProcessing(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        dialog.show({ title: "Permissão Necessária", description: "Precisamos de permissão para salvar fotos." });
        return;
      }

      for (const page of pages) {
        await MediaLibrary.saveToLibraryAsync(page.uri);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      dialog.show({ title: "Sucesso", description: "Imagens salvas na galeria." });
    } catch (error) {
      console.error("Error saving to gallery:", error);
      dialog.show({ title: "Erro", description: "Falha ao salvar imagens." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShareImages = async () => {
    bottomSheetModalRef.current?.dismiss();
    try {
      const uris = pages.map((p) => p.uri);
      if (uris.length === 1) {
        await Sharing.shareAsync(uris[0]);
      } else {
        await RNShare.open({
          urls: uris,
          type: 'image/jpeg',
          title: 'Compartilhar Imagens Escaneadas',
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      // Don't show error if user cancelled
      if (error instanceof Error && error.message.includes("User did not share")) {
        return;
      }
      console.error("Error sharing images:", error);
      dialog.show({ title: "Erro", description: "Falha ao compartilhar imagens." });
    }
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  const clearAll = () => {
    dialog.show({
      title: "Limpar Tudo",
      description: "Deseja remover todas as páginas?",
      buttons: [
        { text: "Cancelar", variant: "ghost" },
        {
          text: "Limpar",
          variant: "destructive",
          onPress: () => {
            setPages([]);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ],
    });
  };

  const GAP_SIZE = 32;
  const PADDING_HORIZONTAL = 32;
  const COLUMN_COUNT = 2;
  const cardWidth =
    (SCREEN_WIDTH - PADDING_HORIZONTAL * 2 - GAP_SIZE * (COLUMN_COUNT - 1)) /
    COLUMN_COUNT;

  const renderItem = useCallback(
    ({ item, index }: { item: ScannedPageItem; index: number }) => {
      return (
        <View
          style={[
            styles.card,
            {
              width: cardWidth,
              backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
            },
          ]}
        >
          <View style={styles.thumbnailContainer}>
            <Image
              source={{ uri: item.uri }}
              style={[
                styles.thumbnailImage,
                { transform: [{ rotate: `${item.rotation}deg` }] },
              ]}
              contentFit="contain"
            />
          </View>

          <Text
            className="font-sans-medium text-xs text-center text-on-surface mt-2 mb-1"
            numberOfLines={1}
          >
            Página {index + 1}
          </Text>

          {/* Action Overlay: Top Left (Rotate) */}
          <TouchableOpacity
            style={[
              styles.overlayButton,
              { top: -10, left: -10, backgroundColor: "#3B82F6" },
            ]}
            onPress={() => rotatePage(item.id)}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <RotateCw size={14} color="#FFF" />
          </TouchableOpacity>

          {/* Action Overlay: Top Right (Delete) */}
          <TouchableOpacity
            style={[
              styles.overlayButton,
              {
                top: -10,
                right: -10,
                backgroundColor: isDark ? "#3F3F46" : "#A1A1AA",
              },
            ]}
            onPress={() => removePage(item.id)}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <X size={14} color="#FFF" />
          </TouchableOpacity>

          {/* Action Overlay: Center Right (Insert After) */}
          <TouchableOpacity
            style={[
              styles.overlayButton,
              {
                top: "50%",
                marginTop: -12,
                right: -29,
                backgroundColor: primaryColor,
              },
            ]}
            onPress={() => handleScan(index + 1)}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Plus size={14} color="#FFF" />
          </TouchableOpacity>

          {/* Action Overlay: Center Left (Insert Before - Only on first item) */}
          {index === 0 && (
            <TouchableOpacity
              style={[
                styles.overlayButton,
                {
                  top: "50%",
                  marginTop: -12,
                  left: -28,
                  backgroundColor: primaryColor,
                },
              ]}
              onPress={() => handleScan(0)}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Plus size={14} color="#FFF" />
            </TouchableOpacity>
          )}

          {/* Badge: Index */}
          <View
            style={[
              styles.pageBadge,
              {
                backgroundColor: isDark
                  ? "rgba(0,0,0,0.6)"
                  : "rgba(255,255,255,0.8)",
              },
            ]}
          >
            <Text style={styles.pageBadgeText}>{index + 1}</Text>
          </View>
        </View>
      );
    },
    [isDark, cardWidth, primaryColor]
  );

  return (
    <View style={{ paddingTop: insets.top }} className="flex-1 bg-surface">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border/10 px-4 pb-4 pt-2">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-3 p-2 -ml-2"
          >
            <ChevronLeft size={28} color={isDark ? "#FFFFFF" : "#000000"} />
          </TouchableOpacity>
          <Text className="font-sans-semibold text-xl text-on-surface">
            Scanner
          </Text>
        </View>
        <View className="flex-row items-center">
          {pages.length > 0 && (
            <TouchableOpacity
              onPress={clearAll}
              className="p-2 mr-2"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Trash2 size={24} color={isDark ? "#D4D4D8" : "#52525B"} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => handleScan()} className="p-2">
            <Plus size={28} color={primaryColor} />
          </TouchableOpacity>
        </View>
      </View>

      {pages.length === 0 ? (
        /* Empty state */
        <View className="flex-1 justify-center items-center px-8">
          <View
            className={`mb-6 h-24 w-24 items-center justify-center rounded-full ${
              isDark ? "bg-primary/20" : "bg-primary/10"
            }`}
          >
            <Camera size={48} color={primaryColor} />
          </View>
          <Text className="font-sans-semibold text-xl text-on-surface text-center mb-2">
            Nenhum Documento
          </Text>
          <Text className="font-sans text-base text-on-surface-secondary text-center mb-8">
            Toque no botão + acima ou abaixo para começar a escanear.
          </Text>
          <TouchableOpacity
            onPress={() => handleScan()}
            className="rounded-full px-8 py-4 gap-4 items-center justify-center flex-row"
            style={{ backgroundColor: primaryColor }}
          >
            <Camera size={20} color="#FFFFFF" className="mr-2" />
            <Text className="font-sans-bold text-white text-base">
              Iniciar Scanner
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-1 pt-4 pb-2">
          <Text className="font-sans text-sm text-on-surface-secondary mb-4 px-4 text-center">
            Organize reordenando o grid, gire ou exclua páginas.
          </Text>
          <Animated.ScrollView
            ref={scrollRef}
            className="flex-1 w-full"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: PADDING_HORIZONTAL,
              paddingTop: 16,
              paddingBottom: 140,
            }}
          >
            <Sortable.Grid
              data={pages}
              scrollableRef={scrollRef}
              renderItem={renderItem}
              columns={COLUMN_COUNT}
              rowGap={GAP_SIZE}
              columnGap={GAP_SIZE}
              autoScrollMaxVelocity={1000}
              autoScrollActivationOffset={80}
              onDragEnd={(params) => {
                setPages(params.data);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              onDragStart={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              }}
            />
          </Animated.ScrollView>
        </View>
      )}

      {/* Processing Overlay */}
      <LoadingOverlay
        visible={isProcessing}
        title="Processando Documento..."
        description="Isto pode levar alguns segundos."
      />

      {/* Bottom Action Bar */}
      {pages.length > 0 && (
        <View
          className="px-4 pt-4 pb-2 bg-surface border-t border-border/10 items-center"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <TouchableOpacity
            onPress={() => {
              bottomSheetModalRef.current?.present();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className="w-full rounded-2xl py-4 items-center justify-center flex-row gap-2"
            style={{ backgroundColor: primaryColor }}
            disabled={isProcessing}
          >
            <Check size={20} color="#FFFFFF" />
            <Text className="font-sans-bold text-white text-base">
              Concluir ({pages.length} {pages.length === 1 ? "página" : "páginas"})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: isDark ? '#18181b' : '#f4f4f5' }}
        handleIndicatorStyle={{ backgroundColor: isDark ? '#52525b' : '#d4d4d8' }}
      >
        <BottomSheetView 
          className="p-6 gap-3"
          style={{ paddingBottom: Math.max(insets.bottom, 24) }}
        >
          <Text className="font-sans-bold text-xl text-on-surface">
            O que deseja fazer?
          </Text>

          {/* Categoria: Nota */}
          <View className="gap-3">
             <Text className="font-sans-semibold text-sm text-on-surface-secondary px-1 uppercase tracking-wider">Configuração</Text>
             <TouchableOpacity 
                onPress={() => setIsOCREnabled(!isOCREnabled)}
                className="flex-row items-center p-4 bg-surface-secondary rounded-2xl border border-border justify-between"
              >
                <View className="flex-row items-center flex-1">
                  <View className="h-10 w-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: withOpacity(primaryColor, 0.1) }}>
                    <Languages size={20} color={primaryColor} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-sans-semibold text-on-surface">PDF Pesquisável (OCR)</Text>
                    <Text className="font-sans text-xs text-on-surface-secondary">Extrai texto e integra ao PDF</Text>
                  </View>
                </View>
                <Switch 
                  value={isOCREnabled}
                  onValueChange={setIsOCREnabled}
                  trackColor={{ false: "#71717a", true: primaryColor }}
                />
              </TouchableOpacity>
          </View>

          {/* Categoria: Nota */}
          <View className="gap-3">
             <Text className="font-sans-semibold text-sm text-on-surface-secondary px-1 uppercase tracking-wider">Nota</Text>
             <Button 
                variant="ghost"
                onPress={handleCreateNote}
                className="flex-row items-center p-4 bg-surface-secondary rounded-2xl border border-border"
              >
                <View className="h-10 w-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: withOpacity(primaryColor, 0.1) }}>
                  <FilePlus2 size={20} color={primaryColor} />
                </View>
                <Button.Text className="flex-1 text-left">Criar Nota com Imagens</Button.Text>
              </Button>
          </View>

          {/* Categoria: PDF */}
          <View className="gap-3">
            <Text className="font-sans-semibold text-sm text-on-surface-secondary px-1 uppercase tracking-wider">PDF</Text>
            <View className="flex-row gap-3">
              <Button 
                variant="ghost"
                onPress={handleSavePDF}
                className="flex-1 flex-row items-center p-4 bg-surface-secondary rounded-2xl border border-border"
              >
                <Download size={18} color={primaryColor} />
                <Button.Text className="ml-2">Salvar</Button.Text>
              </Button>
              <Button 
                variant="ghost"
                onPress={handleSharePDF}
                className="flex-1 flex-row items-center p-4 bg-surface-secondary rounded-2xl border border-border"
              >
                <Share2 size={18} color={primaryColor} />
                <Button.Text className="ml-2">Compartilhar</Button.Text>
              </Button>
            </View>
          </View>

          {/* Categoria: Imagens */}
          <View className="gap-3">
            <Text className="font-sans-semibold text-sm text-on-surface-secondary px-1 uppercase tracking-wider">Imagens</Text>
            <View className="flex-row gap-3">
              <Button 
                variant="ghost"
                onPress={handleSaveGallery}
                className="flex-1 flex-row items-center p-4 bg-surface-secondary rounded-2xl border border-border"
              >
                <Camera size={18} color={primaryColor} />
                <Button.Text className="ml-2">Galeria</Button.Text>
              </Button>
              <Button 
                variant="ghost"
                onPress={handleShareImages}
                className="flex-1 flex-row items-center p-4 bg-surface-secondary rounded-2xl border border-border"
              >
                <Share2 size={18} color={primaryColor} />
                <Button.Text className="ml-2">Compartilhar</Button.Text>
              </Button>
            </View>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    position: "relative",
    marginVertical: 4,
  },
  thumbnailContainer: {
    width: "100%",
    aspectRatio: 1 / 1.414, // A4 aspect ratio
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "#F3F4F6", // fallback background
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  overlayButton: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 10,
  },
  pageBadge: {
    position: "absolute",
    bottom: 32,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    zIndex: 5,
  },
  pageBadgeText: {
    fontFamily: "Montserrat-Bold",
    fontSize: 12,
    color: "#888",
  },
});
