import { Button } from "@/components/ui/Button";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useDialog } from "@/providers/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { withOpacity } from "@/utils/colors";
import { recognizeText, sanitizeForWinAnsi } from "@/utils/ocr";
import { launchScanner } from "@dariyd/react-native-document-scanner";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
    Camera,
    ChevronLeft,
    Download,
    FileText,
    Languages,
    Plus,
    RotateCw,
    Share2,
    Trash2,
    X
} from "lucide-react-native";
import { PDFDocument, PDFName, degrees, rgb } from "pdf-lib";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Dimensions,
    Platform,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import PdfThumbnail from "react-native-pdf-thumbnail";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Sortable from "react-native-sortables";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export type PDFPageItem = {
  id: string; // unique page ID for the list
  sourceUri: string; // The selected file URI
  pageIndex: number; // The 0-based index of this page in its source file
  sourceFileName: string; // Original file name
  uniqueId: string;
  thumbnailUri: string;
  rotation: number;
  isImage?: boolean; // true when this page is a standalone image (not from a PDF)
};

export default function PDFOrganizerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ imageUris?: string }>();
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === "dark";
  const dialog = useDialog();

  const [pages, setPages] = useState<PDFPageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOCREnabled, setIsOCREnabled] = useState(false);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [pendingInsertIndex, setPendingInsertIndex] = useState<number | undefined>(undefined);
  const snapPoints = React.useMemo(() => ["35%"], []);

  // Load images from scanner if passed via route params
  useEffect(() => {
    if (params.imageUris) {
      try {
        const uris: string[] = JSON.parse(params.imageUris);
        if (uris.length > 0) {
          const imagePages: PDFPageItem[] = uris.map((uri, i) => ({
            id: `img-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}`,
            uniqueId: uri,
            sourceUri: uri,
            pageIndex: 0,
            sourceFileName: `Página ${i + 1}`,
            thumbnailUri: uri,
            rotation: 0,
            isImage: true,
          }));
          setPages(imagePages);
        }
      } catch (e) {
        console.error("Error parsing imageUris:", e);
      }
    }
  }, []);

  const handleAddOptions = (insertIndex?: number) => {
    setPendingInsertIndex(insertIndex);
    bottomSheetModalRef.current?.present();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const scanDocument = async () => {
    bottomSheetModalRef.current?.dismiss();
    try {
      const result = await launchScanner({
        quality: 1,
        includeBase64: false,
      });

      if (result.didCancel) return;
      if (result.error) {
        dialog.show({ title: 'Erro', description: result.errorMessage || "Ocorreu um erro ao escanear.", variant: 'error' });
        return;
      }

      if (result.images && result.images.length > 0) {
        const newItems: PDFPageItem[] = result.images.map((img, i) => ({
          id: `img-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}`,
          uniqueId: img.uri,
          sourceUri: img.uri,
          pageIndex: 0,
          sourceFileName: `Página Escaneada ${pages.length + i + 1}`,
          thumbnailUri: img.uri,
          rotation: 0,
          isImage: true,
        }));

        setPages((prev) => {
          const updated = [...prev];
          if (typeof pendingInsertIndex === "number") {
            updated.splice(pendingInsertIndex, 0, ...newItems);
          } else {
            updated.push(...newItems);
          }
          return updated;
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.error("Scanner Error:", e);
      dialog.show({ title: 'Erro', description: 'Não foi possível abrir o scanner.', variant: 'error' });
    }
  };

  const handleImportFiles = async () => {
    bottomSheetModalRef.current?.dismiss();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets) return;

      setIsProcessing(true);
      const newPages: PDFPageItem[] = [];

      for (const asset of result.assets) {
        try {
          if (asset.mimeType?.startsWith("image/")) {
            newPages.push({
              id: `img-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              uniqueId: asset.uri,
              sourceUri: asset.uri,
              pageIndex: 0,
              sourceFileName: asset.name,
              thumbnailUri: asset.uri,
              rotation: 0,
              isImage: true,
            });
          } else {
            const thumbnails = await PdfThumbnail.generateAllPages(asset.uri, 70);
            thumbnails.forEach((thumb, index) => {
              newPages.push({
                id: `${asset.name}-${index}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                uniqueId: `${asset.uri}-${index}`,
                sourceUri: asset.uri,
                pageIndex: index,
                sourceFileName: asset.name,
                thumbnailUri: thumb.uri,
                rotation: 0,
              });
            });
          }
        } catch (error) {
          console.error(`Error processing file ${asset.name}:`, error);
        }
      }

      if (newPages.length > 0) {
        setPages((prev) => {
          const updated = [...prev];
          if (typeof pendingInsertIndex === "number") {
            updated.splice(pendingInsertIndex, 0, ...newPages);
          } else {
            updated.push(...newPages);
          }
          return updated;
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Import error:", error);
      dialog.show({ title: 'Erro', description: 'Não foi possível importar os arquivos.', variant: 'error' });
    } finally {
      setIsProcessing(false);
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
      description: "Tem certeza que deseja remover todas as páginas?",
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
      ]
    });
  };

  const removePage = (id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const rotatePage = (id: string) => {
    setPages((prev) => 
      prev.map((p) => p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p)
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const generatePDFBase64 = async (): Promise<string | null> => {
    if (pages.length === 0) return null;
    try {
      setIsProcessing(true);
      const mergedPdf = await PDFDocument.create();
      const loadedDocs: Record<string, PDFDocument> = {};

      for (const pageItem of pages) {
        if (pageItem.isImage) {
          // Embed image as a full PDF page
          const imgData = await FileSystem.readAsStringAsync(pageItem.sourceUri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          let embeddedImage;
          const lowerUri = pageItem.sourceUri.toLowerCase();
          if (lowerUri.endsWith(".png")) {
            embeddedImage = await mergedPdf.embedPng(`data:image/png;base64,${imgData}`);
          } else {
            // Default to JPEG for scanner images
            embeddedImage = await mergedPdf.embedJpg(`data:image/jpeg;base64,${imgData}`);
          }

          const imgWidth = embeddedImage.width;
          const imgHeight = embeddedImage.height;
          const page = mergedPdf.addPage([imgWidth, imgHeight]);

          // OCR Layer for Images
          if (isOCREnabled) {
            const ocrData = await recognizeText(pageItem.sourceUri);
            if (ocrData) {
              for (const block of ocrData.blocks) {
                for (const line of block.lines) {
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
                      size: frame.height,
                      color: rgb(0, 0, 0),
                      opacity: 0,
                    });
                  }
                }
              }
            }
          }

          // Apply rotation
          if (pageItem.rotation !== 0) {
            page.setRotation(degrees(pageItem.rotation));
          }

          page.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: imgWidth,
            height: imgHeight,
          });
        } else {
          // Handle normal PDF pages
          if (!loadedDocs[pageItem.sourceUri]) {
            const fileData = await FileSystem.readAsStringAsync(pageItem.sourceUri, {
               encoding: FileSystem.EncodingType.Base64,
            });
            loadedDocs[pageItem.sourceUri] = await PDFDocument.load(fileData);
          }

          const sourceDoc = loadedDocs[pageItem.sourceUri];
          
          // Intelligent OCR: Check if the page has selectable text
          if (isOCREnabled) {
            const pdfPage = sourceDoc.getPages()[pageItem.pageIndex];
            
            // More robust check: check for Font resources AND text operators in content stream
            const hasFonts = pdfPage.node.Resources()?.get(PDFName.of('Font'));
            
            // Some PDFs have fonts in resources but no actual text in the stream (e.g. empty scan from a specific software)
            // We check for "BT" (Begin Text) operator as a proxy for actual text content
            let hasTextOperators = false;
            try {
              const contentStream = pdfPage.node.Contents();
              if (contentStream) {
                // Contents can be an array of streams or a single stream
                const streams = Array.isArray(contentStream) ? contentStream : [contentStream];
                for (const stream of streams) {
                  const decoded = stream.decode();
                  const text = new TextDecoder().decode(decoded);
                  if (text.includes('BT') || text.includes('Tj') || text.includes('TJ')) {
                    hasTextOperators = true;
                    break;
                  }
                }
              }
            } catch (e) {
              console.warn("Error inspecting content stream:", e);
            }

            const needsOCR = !hasFonts || !hasTextOperators;

            if (needsOCR) {
              // Image-only PDF page: Rasterize (using thumbnail) and apply OCR
              const imgData = await FileSystem.readAsStringAsync(pageItem.thumbnailUri, {
                encoding: FileSystem.EncodingType.Base64,
              });
              
              const embeddedImage = await mergedPdf.embedJpg(`data:image/jpeg;base64,${imgData}`);
              const { width, height } = embeddedImage;
              const newPage = mergedPdf.addPage([width, height]);
              
              const ocrData = await recognizeText(pageItem.thumbnailUri);
              if (ocrData) {
                for (const block of ocrData.blocks) {
                  for (const line of block.lines) {
                    for (const element of line.elements) {
                      const { frame } = element;
                      if (!frame) continue;
                      const sanitizedText = sanitizeForWinAnsi(element.text);
                      if (!sanitizedText) continue;
                      newPage.drawText(sanitizedText, {
                        x: frame.left,
                        y: height - frame.top - frame.height,
                        size: frame.height,
                        color: rgb(0, 0, 0),
                        opacity: 0,
                      });
                    }
                  }
                }
              }

              newPage.drawImage(embeddedImage, {
                x: 0,
                y: 0,
                width,
                height,
              });
              
              if (pageItem.rotation !== 0) {
                newPage.setRotation(degrees(pageItem.rotation));
              }
              continue;
            }
          }

          // Default: Copy original vector page
          const [copiedPage] = await mergedPdf.copyPages(sourceDoc, [pageItem.pageIndex]);
          
          // Apply rotation
          if (pageItem.rotation !== 0) {
             const currentRotation = copiedPage.getRotation().angle;
             copiedPage.setRotation(degrees(currentRotation + pageItem.rotation));
          }

          mergedPdf.addPage(copiedPage);
        }
      }

      return await mergedPdf.saveAsBase64({ dataUri: false });
    } catch (error) {
      console.error("Error generating PDF:", error);
      dialog.show({ title: "Erro", description: "Ocorreu um erro ao processar o arquivo PDF." });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShare = async () => {
    const base64Data = await generatePDFBase64();
    if (!base64Data) return;
    try {
      const fileUri = `${FileSystem.cacheDirectory}organizado-${Date.now()}.pdf`;
      await FileSystem.writeAsStringAsync(fileUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Compartilhar PDF Organizado' });
    } catch (error) {
       console.error("Error sharing PDF:", error);
       dialog.show({ title: "Erro", description: "Falha ao compartilhar o arquivo." });
    }
  };

  const handleSaveLocal = async () => {
    const base64Data = await generatePDFBase64();
    if (!base64Data) return;
    try {
      if (Platform.OS === 'android') {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const uri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, `organizado-${Date.now()}.pdf`, 'application/pdf');
          await FileSystem.writeAsStringAsync(uri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          dialog.show({ title: "Sucesso", description: "PDF salvo com sucesso." });
        }
      } else {
        const fileUri = `${FileSystem.cacheDirectory}organizado-${Date.now()}.pdf`;
        await FileSystem.writeAsStringAsync(fileUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await Sharing.shareAsync(fileUri, { UTI: 'com.adobe.pdf' });
      }
    } catch (error) {
       console.error("Error saving PDF:", error);
       dialog.show({ title: "Erro", description: "Falha ao salvar o arquivo." });
    }
  };

  const GAP_SIZE = 32;
  const PADDING_HORIZONTAL = 32;
  const COLUMN_COUNT = 2;
  const cardWidth = (SCREEN_WIDTH - (PADDING_HORIZONTAL * 2) - (GAP_SIZE * (COLUMN_COUNT - 1))) / COLUMN_COUNT;

  const renderItem = useCallback(
    ({ item, index }: { item: PDFPageItem; index: number }) => {
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
              source={{ uri: item.thumbnailUri }}
              style={[
                styles.thumbnailImage, 
                { transform: [{ rotate: `${item.rotation}deg` }] }
              ]}
              contentFit="contain"
            />
          </View>
          
          <Text
             className="font-sans-medium text-xs text-center text-on-surface mt-2 mb-1"
             numberOfLines={1}
             ellipsizeMode="middle"
          >
             {item.sourceFileName}
          </Text>

          {/* Action Overlay: Top Left (Rotate) */}
          <TouchableOpacity 
             style={[styles.overlayButton, { top: -10, left: -10, backgroundColor: "#3B82F6" }]} 
             onPress={() => rotatePage(item.id)}
             hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <RotateCw size={14} color="#FFF" />
          </TouchableOpacity>

          {/* Action Overlay: Top Right (Delete) */}
          <TouchableOpacity 
             style={[styles.overlayButton, { top: -10, right: -10, backgroundColor: isDark ? "#3F3F46" : "#A1A1AA" }]} 
             onPress={() => removePage(item.id)}
             hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <X size={14} color="#FFF" />
          </TouchableOpacity>

          {/* Action Overlay: Center Right (Insert After) */}
          <TouchableOpacity 
             style={[styles.overlayButton, { top: '50%', marginTop: -12, right: -29, backgroundColor: primaryColor }]} 
             onPress={() => handleAddOptions(index + 1)}
             hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Plus size={14} color="#FFF" />
          </TouchableOpacity>

          {/* Action Overlay: Center Left (Insert Before - Only on first item) */}
          {index === 0 && (
            <TouchableOpacity 
               style={[styles.overlayButton, { top: '50%', marginTop: -12, left: -28, backgroundColor: primaryColor }]} 
               onPress={() => handleAddOptions(0)}
               hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Plus size={14} color="#FFF" />
            </TouchableOpacity>
          )}

          {/* Badge: Page Number */}
          <View style={[styles.pageBadge, { backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.8)" }]}>
             <Text style={styles.pageBadgeText}>{index + 1}</Text>
          </View>
        </View>
      );
    },
    [isDark, cardWidth, primaryColor, handleAddOptions]
  );

  return (
    <>
    <View style={{ paddingTop: insets.top }} className="flex-1 bg-surface">
      <View className="flex-row items-center justify-between border-b border-border/10 px-4 pb-4 pt-2">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-3 p-2 -ml-2"
          >
            <ChevronLeft size={28} color={isDark ? "#FFFFFF" : "#000000"} />
          </TouchableOpacity>
          <Text className="font-sans-semibold text-xl text-on-surface">
            Organizador de PDF
          </Text>
        </View>
        <View className="flex-row items-center">
         {pages.length > 0 && (
           <TouchableOpacity
              onPress={clearAll}
              className="p-2 mr-2"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={isProcessing}
            >
              <Trash2 size={24} color={isDark ? "#D4D4D8" : "#52525B"} />
            </TouchableOpacity>
         )}
          <TouchableOpacity
            onPress={() => handleAddOptions()}
            className="p-2"
            disabled={isProcessing}
          >
            <Plus size={28} color={primaryColor} />
          </TouchableOpacity>
        </View>
      </View>

      <LoadingOverlay
        visible={isProcessing}
        title="Processando PDF..."
        description="Isto pode levar alguns segundos."
      />

      {pages.length === 0 ? (
        <View className="flex-1 justify-center items-center px-8">
           <View className={`mb-6 h-24 w-24 items-center justify-center rounded-full ${isDark ? "bg-primary/20" : "bg-primary/10"}`}>
             <FileText size={48} color={isDark ? "#A78BFA" : "#7C3AED"} />
           </View>
           <Text className="font-sans-semibold text-xl text-on-surface text-center mb-2">
             Nenhum PDF Importado
           </Text>
           <Text className="font-sans text-base text-on-surface-secondary text-center mb-8">
             Toque no botão + acima ou abaixo para adicionar documentos ou escanear.
           </Text>
           <TouchableOpacity
             onPress={() => handleAddOptions()}
             className="rounded-full px-8 py-4 items-center justify-center flex-row"
             style={{ backgroundColor: primaryColor }}
           >
             <Plus size={20} color="#FFFFFF" className="mr-2" />
             <Text className="font-sans-bold text-white text-base">Adicionar Páginas</Text>
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
               paddingBottom: 20 
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

      {pages.length > 0 && (
          <View className="px-4 pt-4 pb-2 bg-surface border-t border-border/10 gap-4" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
            {/* OCR Toggle Row */}
            <TouchableOpacity 
              onPress={() => setIsOCREnabled(!isOCREnabled)}
              className="flex-row items-center p-3 bg-surface-secondary rounded-2xl border border-border justify-between mx-1"
            >
              <View className="flex-row items-center flex-1">
                <View className="h-8 w-8 rounded-full items-center justify-center mr-3" style={{ backgroundColor: withOpacity(primaryColor, 0.1) }}>
                  <Languages size={16} color={primaryColor} />
                </View>
                <View className="flex-1">
                  <Text className="font-sans-semibold text-sm text-on-surface">PDF Pesquisável (OCR)</Text>
                  <Text className="font-sans text-[10px] text-on-surface-secondary">Reconhecer texto em fotos e scans</Text>
                </View>
              </View>
              <Switch 
                value={isOCREnabled}
                onValueChange={setIsOCREnabled}
                trackColor={{ false: "#71717a", true: primaryColor }}
                style={{ transform: [{ scale: 0.8 }] }}
              />
            </TouchableOpacity>

            <View className="flex-row justify-between gap-3">
              <TouchableOpacity
                onPress={handleSaveLocal}
                disabled={isProcessing}
                className={`flex-1 rounded-xl py-4 items-center justify-center flex-row gap-2 ${isProcessing ? 'opacity-50' : 'opacity-100'}`}
                style={{ backgroundColor: isDark ? "#262626" : "#E5E7EB" }}
              >
                <Download size={20} color={isDark ? "#FFFFFF" : "#000000"} />
                <Text className="font-sans-bold text-base" style={{ color: isDark ? "#FFFFFF" : "#000000" }}>
                  Salvar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleShare}
                disabled={isProcessing}
                className={`flex-1 rounded-xl py-4 items-center justify-center flex-row gap-2 ${isProcessing ? 'opacity-50' : 'opacity-100'}`}
                style={{ backgroundColor: primaryColor }}
              >
                <Share2 size={20} color="#FFFFFF" />
                <Text className="font-sans-bold text-white text-base">
                  Compartilhar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: resolvedTheme === 'dark' ? '#18181b' : '#f4f4f5' }}
        handleIndicatorStyle={{ backgroundColor: resolvedTheme === 'dark' ? '#52525b' : '#d4d4d8' }}
      >
        <BottomSheetView 
          className="p-6 gap-4"
          style={{ paddingBottom: Math.max(insets.bottom, 24) }}
        >
          <Text className="font-sans-bold text-xl text-on-surface mb-2">
            Adicionar à Ordem
          </Text>

          <Button 
            variant="ghost"
            onPress={handleImportFiles}
            className="flex-row items-center p-4 bg-surface-secondary rounded-2xl border border-border"
          >
            <View className="h-10 w-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: withOpacity(primaryColor, 0.1) }}>
              <FileText size={20} color={primaryColor} />
            </View>
            <Button.Text className="flex-1 text-left">Importar Arquivo (PDF ou Imagem)</Button.Text>
          </Button>

          <Button 
            variant="ghost"
            onPress={scanDocument}
            className="flex-row items-center p-4 bg-surface-secondary rounded-2xl border border-border"
          >
            <View className="h-10 w-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: withOpacity(primaryColor, 0.1) }}>
              <Camera size={20} color={primaryColor} />
            </View>
            <Button.Text className="flex-1 text-left">Escanear Documento</Button.Text>
          </Button>
        </BottomSheetView>
      </BottomSheetModal>
    </>
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
    position: 'relative',
    marginVertical: 4,
  },
  thumbnailContainer: {
    width: '100%',
    aspectRatio: 1 / 1.414, // A4 aspect ratio 
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#F3F4F6', // fallback background 
    alignItems: 'center',
    justifyContent: 'center'
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  overlayButton: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 10,
  },
  pageBadge: {
    position: 'absolute',
    bottom: 32,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    zIndex: 5,
  },
  pageBadgeText: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 12,
    color: '#888', 
  }
});
