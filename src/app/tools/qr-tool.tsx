import { Button } from "@/components/ui/Button";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { KeyboardAvoidingView } from "@/components/ui/KeyboardAvoidingView";
import { ToolActions } from "@/components/ui/ToolActions";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useDialog } from "@/providers/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { withOpacity } from "@/utils/colors";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView
} from "@gorhom/bottom-sheet";
import BarcodeScanning from "@react-native-ml-kit/barcode-scanning";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  Camera,
  Check,
  ChevronLeft,
  Copy,
  Download,
  ExternalLink,
  FilePlus2,
  Image as ImageIcon,
  QrCode,
  ScanLine,
  Share2,
  Wifi,
  X
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated, PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WifiManager from "react-native-wifi-reborn";

type TabType = "create" | "read";

type QRResult = {
  type: "url" | "wifi" | "text";
  data: string;
  wifiData?: {
    ssid?: string;
    password?: string;
    encryption?: string;
  };
};

export default function QrToolScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const rawParams = useLocalSearchParams();
  const params = rawParams as { mode?: string; imageUri?: string };
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === "dark";
  const dialog = useDialog();
  // Removed conditional return block here to satisfy React Hooks rules.

  const [permission, requestPermission] = useCameraPermissions();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = React.useMemo(() => ["45%"], []);

  const [activeTab, setActiveTab] = useState<TabType>(params.mode === "read" ? "read" : "create");
  const tabAnim = useRef(new Animated.Value(params.mode === "read" ? 1 : 0)).current;

  // Create state
  const [createContent, setCreateContent] = useState("");
  const [qrColor, setQrColor] = useState("#000000");
  const [qrBgColor, setQrBgColor] = useState("#FFFFFF");
  const qrRef = useRef<any>(null);

  // Read state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<QRResult | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [flexToggle, setFlexToggle] = useState(true);

  const { isVisible: isKeyboardVisible } = useKeyboard();

  useEffect(() => {
    setFlexToggle(!isKeyboardVisible);
  }, [isKeyboardVisible]);

  useEffect(() => {
    if (params?.imageUri) {
      handleScanImage(params.imageUri);
    }
  }, [params?.imageUri]);

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    Animated.spring(tabAnim, {
      toValue: tab === "create" ? 0 : 1,
      useNativeDriver: false,
      friction: 8,
      tension: 50,
    }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const parseQRContent = (content: string): QRResult => {
    if (content.startsWith("http://") || content.startsWith("https://")) {
      return { type: "url", data: content };
    }
    if (content.startsWith("WIFI:")) {
      const parts = content.replace("WIFI:", "").split(";");
      const wifi: any = {};
      parts.forEach(part => {
        if (part.startsWith("S:")) wifi.ssid = part.substring(2);
        if (part.startsWith("P:")) wifi.password = part.substring(2);
        if (part.startsWith("T:")) wifi.encryption = part.substring(2);
      });
      return { type: "wifi", data: content, wifiData: wifi };
    }
    return { type: "text", data: content };
  };

  const handleScanImage = async (uri: string) => {
    setIsProcessingImage(true);
    try {
      const barcodes = await BarcodeScanning.scan(uri);
      if (barcodes.length > 0) {
        const result = parseQRContent(barcodes[0].value || "");
        setScanResult(result);
        switchTab("read");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        dialog.show({
          title: "Nenhum Código",
          description: "Não foi possível encontrar um código QR nesta imagem.",
          buttons: [{ text: "OK" }],
        });
      }
    } catch (error) {
      console.error("Error scanning image:", error);
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (!isScanning) return;
    const result = parseQRContent(data);
    setScanResult(result);
    setIsScanning(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    if (result.type === "wifi" && result.wifiData) {
        handleConnectWifi(result.wifiData);
    }
  };

  const handlePickAndScan = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        handleScanImage(result.assets[0].uri);
      }
    } catch (err) {
      console.error("Error picking document:", err);
    }
  };

  const handleSaveQr = async () => {
    if (!qrRef.current) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        dialog.show({
          title: "Sem Permissão",
          description: "Precisamos de permissão para salvar na galeria.",
          buttons: [{ text: "OK" }],
        });
        return;
      }

      qrRef.current.toDataURL(async (data: string) => {
        const fileUri = FileSystem.cacheDirectory + "qr-code.png";
        await FileSystem.writeAsStringAsync(fileUri, data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await MediaLibrary.saveToLibraryAsync(fileUri);
        dialog.show({
          title: "Sucesso",
          description: "Código QR salvo na galeria.",
          buttons: [{ text: "Oba!" }],
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      });
    } catch (error) {
      console.error("Error saving QR:", error);
    }
  };

  const handleCreateNote = async () => {
    if (!qrRef.current) return;
    bottomSheetModalRef.current?.dismiss();
    try {
      qrRef.current.toDataURL(async (data: string) => {
        const fileUri = FileSystem.cacheDirectory + `qr-${Date.now()}.png`;
        await FileSystem.writeAsStringAsync(fileUri, data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        router.push({
          pathname: "/task/editor",
          params: { sharedImages: JSON.stringify([fileUri]) },
        });
      });
    } catch (error) {
      console.error("Error adding to note:", error);
      dialog.show({ title: "Erro", description: "Não foi possível adicionar o QR Code à nota." });
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

  // Safety check for navigation context readiness
  // (Moved here to ensure all Hooks render unconditionally above)
  if (!router || !params || !insets) return null;

  const handleShareQr = () => {
    if (!qrRef.current) return;
    qrRef.current.toDataURL(async (data: string) => {
      const fileUri = FileSystem.cacheDirectory + "qr-code.png";
      await FileSystem.writeAsStringAsync(fileUri, data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await Sharing.shareAsync(fileUri);
    });
  };

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleOpenLink = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    }
  };
  
  const handleConnectWifi = async (wifi?: { ssid?: string; password?: string; encryption?: string }) => {
    if (!wifi || !wifi.ssid) return;

    try {
        const currentSSID = await WifiManager.getCurrentWifiSSID();
        // Android often returns SSID surrounded by quotes
        const normalizedCurrent = currentSSID?.replace(/^"|"$/g, '');
        
        if (normalizedCurrent === wifi.ssid) {
            if (Platform.OS === 'android') {
                ToastAndroid.show(`Já conectado a ${wifi.ssid}`, ToastAndroid.SHORT);
            }
            return;
        }
    } catch (e) {
        console.log("Could not check current SSID", e);
    }

    try {
        if (Platform.OS === 'android') {
            // Android 10+ requires location permission to connect to WiFi
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
            );

            if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                try {
                    // suggestWifiNetwork makes the connection persistent and system-wide on Android 10+
                    await WifiManager.suggestWifiNetwork([{
                        ssid: wifi.ssid,
                        password: wifi.password || "",
                        isAppInteractionRequired: false
                    }]);
                    return; // Success, system will handle the rest
                } catch (wifiError) {
                    console.warn("Persistent connect failed, falling back to temporary connect:", wifiError);
                    try {
                        // Springback to temporary connection if suggestion fails
                        await WifiManager.connectToProtectedSSID(
                            wifi.ssid, 
                            wifi.password || "", 
                            wifi.encryption === 'WEP',
                            false
                        );
                        return;
                    } catch (tempError) {
                        console.warn("Temporary connect also failed:", tempError);
                    }
                }
            }
            // Fallback for Android if auto-connect fails or permission denied
            await Linking.sendIntent('android.settings.WIFI_SETTINGS');
        } else {
            // iOS doesn't allow direct connection without specific entitlements, open settings
            await Linking.openURL('App-Prefs:root=WIFI');
        }
    } catch (error) {
        console.error("Error handling Wi-Fi connection:", error);
        Linking.openSettings();
    }
  };

  const tabIndicatorLeft = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [5, containerWidth > 0 ? (containerWidth / 2) + 1 : 5],
  });

  return (
    <KeyboardAvoidingView 
      className="flex-1 bg-surface" 
      behavior="padding"
      keyboardVerticalOffset={20}
      style={[
        { paddingTop: insets.top },
        flexToggle ? { flexGrow: 1 } : { flex: 1 }
      ]}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-outline/10">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface-secondary/50"
        >
          <ChevronLeft size={24} color={isDark ? "#FFF" : "#000"} />
        </TouchableOpacity>
        <Text className="font-sans-bold text-lg text-on-surface">Código QR</Text>
        <View className="w-10" />
      </View>

      {/* iOS Style Animated Toggle */}
      <View className="px-4 mt-6">
        <View 
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
          style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", borderWidth: 1 }}
          className="bg-surface-secondary h-12 rounded-full p-1 flex-row relative"
        >
          <Animated.View 
            style={[
              styles.tabIndicator, 
              { 
                left: tabIndicatorLeft,
                width: containerWidth > 0 ? (containerWidth - 14) / 2 : 0,
                backgroundColor: isDark ? "#2A2A2A" : "#FFFFFF",
                shadowColor: "#000",
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 2,
              }
            ]} 
          />
          <TouchableOpacity 
            className="flex-1 items-center justify-center z-10"
            onPress={() => switchTab("create")}
          >
            <Text className={`font-sans-bold ${activeTab === "create" ? "text-on-surface" : "text-on-surface-secondary text-sm"}`}>Criar</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className="flex-1 items-center justify-center z-10"
            onPress={() => switchTab("read")}
          >
            <Text className={`font-sans-bold ${activeTab === "read" ? "text-on-surface" : "text-on-surface-secondary text-sm"}`}>Ler</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 mt-6" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        {activeTab === "create" ? (
          <View className="items-center">
            {/* QR Code Preview Container */}
            <View 
              style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", borderWidth: 1 }}
              className="w-full bg-surface-secondary rounded-[32px] p-6 items-center justify-center mb-8"
            >
               <View 
                  style={{ 
                    backgroundColor: qrBgColor,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: 0.15,
                    shadowRadius: 16,
                    elevation: 10,
                    borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                    borderWidth: 1.5
                  }}
                  className="p-6 rounded-[24px] items-center justify-center"
               >
                <QRCode
                    value={createContent || "https://genly.app"}
                    size={200}
                    color={qrColor}
                    backgroundColor={qrBgColor}
                    quietZone={12}
                    getRef={(c) => (qrRef.current = c)}
                />
               </View>
                <View className="mt-8 w-full">
                  <Button
                    onPress={() => {
                      bottomSheetModalRef.current?.present();
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    className="w-full flex-row"
                  >
                    <Button.Icon icon={Check} />
                    <Button.Text>Finalizar e Salvar</Button.Text>
                  </Button>
               </View>
            </View>

            {/* customization */}
            <View className="w-full">
                <Text className="font-sans-bold text-lg text-on-surface mb-2 px-1">Conteúdo</Text>
                <View 
                  style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", borderWidth: 1 }}
                  className="bg-surface-secondary rounded-3xl px-4"
                >
                    <TextInput
                        placeholder="Digite um link ou texto..."
                        placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)"}
                        className="font-sans text-base text-on-surface"
                        multiline
                        value={createContent}
                        onChangeText={setCreateContent}
                        textAlignVertical="top"
                    />
                </View>

                <Text className="font-sans-bold text-lg text-on-surface mt-6 mb-2 px-1">Cor do Código</Text>
                <ColorPicker
                    selectedColor={qrColor}
                    onSelect={setQrColor}
                    isDark={isDark}
                />

                <Text className="font-sans-bold text-lg text-on-surface mt-6 mb-2 px-1">Cor de Fundo</Text>
                <ColorPicker
                    selectedColor={qrBgColor}
                    onSelect={setQrBgColor}
                    isDark={isDark}
                />
            </View>
          </View>
        ) : (
          <View>
            {!scanResult ? (
              <View className="items-center">
                <View 
                  style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", borderWidth: 1 }}
                  className="h-64 w-full bg-surface-secondary rounded-3xl items-center justify-center mb-8 overflow-hidden"
                >
                    {isProcessingImage ? (
                        <ActivityIndicator size="large" color={primaryColor} />
                    ) : (
                        <ScanLine size={100} color={primaryColor} strokeWidth={1} />
                    )}
                </View>
                
                <Text className="text-center font-sans-bold text-xl text-on-surface mb-2">Ler Código QR</Text>
                <Text className="text-center font-sans text-on-surface-secondary mb-8">
                    Importe uma imagem da galeria para extrair as informações.
                </Text>

                <ToolActions>
                    <ToolActions.Button 
                        onPress={handlePickAndScan}
                        icon={<ImageIcon size={24} color={primaryColor} />}
                        title="Galeria"
                        description="Escolher imagem e carregar"
                    />

                    <ToolActions.Button 
                        onPress={() => setIsScanning(true)}
                        icon={<Camera size={24} color={primaryColor} />}
                        title="Câmera"
                        description="Escanear com a câmera"
                    />
                </ToolActions>
              </View>
            ) : (
              <View>
                {/* Result Card */}
                <View 
                  style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", borderWidth: 1 }}
                  className="bg-surface-secondary p-6 rounded-3xl"
                >
                    <View className="flex-row items-center mb-6">
                        <View className="h-14 w-14 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: withOpacity(primaryColor, 0.1) }}>
                            {scanResult.type === "url" && <ExternalLink size={28} color={primaryColor} />}
                            {scanResult.type === "wifi" && <Wifi size={28} color={primaryColor} />}
                            {scanResult.type === "text" && <QrCode size={28} color={primaryColor} />}
                        </View>
                        <View className="flex-1">
                            <Text className="font-sans-bold text-lg text-on-surface">
                                {scanResult.type === "url" && "Link Encontrado"}
                                {scanResult.type === "wifi" && "Rede Wi-Fi"}
                                {scanResult.type === "text" && "Texto Escaneado"}
                            </Text>
                            <Text className="font-sans text-xs text-on-surface-secondary uppercase tracking-widest mt-0.5">Resultado da Leitura</Text>
                        </View>
                        <TouchableOpacity onPress={() => setScanResult(null)} className="h-10 w-10 items-center justify-center rounded-full bg-surface/50">
                            <X size={20} color={isDark ? "#FFF" : "#000"} />
                        </TouchableOpacity>
                    </View>

                    {scanResult.type === "wifi" && scanResult.wifiData ? (
                        <View className="gap-4">
                            <View className="p-4 bg-surface/50 rounded-2xl border border-outline/5">
                                <Text className="font-sans text-xs text-on-surface-secondary mb-1">SSID (Nome da Rede)</Text>
                                <Text className="font-sans-bold text-lg text-on-surface">{scanResult.wifiData.ssid || "Desconhecido"}</Text>
                            </View>
                            <View className="p-4 bg-surface/50 rounded-2xl border border-outline/5 relative">
                                <Text className="font-sans text-xs text-on-surface-secondary mb-1">Senha</Text>
                                <Text className="font-sans-bold text-lg text-on-surface">{scanResult.wifiData.password || "Sem senha"}</Text>
                                <TouchableOpacity 
                                    onPress={() => handleCopy(scanResult.wifiData?.password || "")}
                                    className="absolute right-4 top-4 h-10 w-10 items-center justify-center rounded-xl bg-primary/10"
                                >
                                    <Copy size={18} color={primaryColor} />
                                </TouchableOpacity>
                            </View>
                            <Button 
                                variant="filled"
                                onPress={() => handleConnectWifi(scanResult.wifiData)}
                                className="w-full flex-row"
                                style={{ backgroundColor: primaryColor }}
                            >
                                <Button.Icon icon={Wifi} />
                                <Button.Text className="ml-2 font-sans-bold text-white">Conectar à Rede</Button.Text>
                            </Button>
                        </View>
                    ) : (
                        <View className="p-5 bg-surface/50 rounded-2xl border border-outline/5 min-h-[100px] justify-center">
                            <Text className="font-sans text-base text-on-surface">{scanResult.data}</Text>
                        </View>
                    )}

                    <View className="mt-8 gap-3">
                        {scanResult.type === "url" && (
                            <Button onPress={() => handleOpenLink(scanResult.data)} className="w-full">
                                <Button.Icon icon={ExternalLink} />
                                <Button.Text>Abrir Link no Navegador</Button.Text>
                            </Button>
                        )}
                        <TouchableOpacity 
                            style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", borderWidth: 1 }}
                            onPress={() => handleCopy(scanResult.data)}
                            className="w-full h-14 bg-surface-secondary rounded-2xl items-center justify-center flex-row"
                        >
                            <Copy size={18} color={isDark ? "#FFF" : "#000"} />
                            <Text className="ml-3 font-sans-bold text-on-surface">Copiar Conteúdo</Text>
                        </TouchableOpacity>
                    </View>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Camera Scanning Overlay */}
      {isScanning && (
        <View style={StyleSheet.absoluteFill} className="bg-black z-50">
          {!permission?.granted ? (
            <View className="flex-1 items-center justify-center p-6 bg-surface">
              <Camera size={48} color={primaryColor} />
              <Text className="text-center font-sans-bold text-xl text-on-surface mt-6 mb-2">Permissão da Câmera</Text>
              <Text className="text-center font-sans text-on-surface-secondary mb-8">Precisamos da sua permissão para usar a câmera e ler códigos QR.</Text>
              <Button onPress={requestPermission} className="w-full">
                <Button.Text>Conceder Permissão</Button.Text>
              </Button>
              <TouchableOpacity onPress={() => setIsScanning(false)} className="mt-6">
                <Text className="font-sans-bold text-on-surface-secondary">Cancelar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-1">
              <CameraView
                style={StyleSheet.absoluteFill}
                onBarcodeScanned={handleBarcodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ["qr"],
                }}
              />
              {/* Scanning UI Overlay */}
              <View className="flex-1 items-center justify-center">
                 <View className="w-64 h-64 border-2 border-white rounded-[40px] border-dashed items-center justify-center">
                    <Animated.View 
                        style={{
                            width: '100%',
                            height: 2,
                            backgroundColor: primaryColor,
                            shadowColor: primaryColor,
                            shadowOpacity: 0.8,
                            shadowRadius: 10,
                            elevation: 10,
                        }}
                    />
                 </View>
                 <Text className="text-white font-sans-bold text-lg mt-8">Posicione o código QR no centro</Text>
              </View>

              {/* Close Button */}
              <TouchableOpacity
                onPress={() => setIsScanning(false)}
                className="absolute top-12 right-6 h-12 w-12 items-center justify-center rounded-full bg-black/50"
              >
                <X size={28} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}
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
          className="p-6 gap-6"
          style={{ paddingBottom: Math.max(insets.bottom, 24) }}
        >
          <Text className="font-sans-bold text-xl text-on-surface">
            O que deseja fazer?
          </Text>

          <View className="gap-3">
             <Text className="font-sans-semibold text-sm text-on-surface-secondary px-1 uppercase tracking-wider">Nota</Text>
             <Button 
                variant="ghost"
                onPress={handleCreateNote}
                className="flex-row items-center p-4 bg-surface-secondary rounded-2xl border border-border"
                style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", borderWidth: 1 }}
              >
                <View className="h-10 w-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: withOpacity(primaryColor, 0.1) }}>
                  <FilePlus2 size={20} color={primaryColor} />
                </View>
                <Button.Text className="flex-1 text-left">Adicionar à Nova Nota</Button.Text>
              </Button>
          </View>

          <View className="gap-3">
            <Text className="font-sans-semibold text-sm text-on-surface-secondary px-1 uppercase tracking-wider">Arquivo</Text>
            <View className="flex-row gap-3">
              <Button 
                variant="ghost"
                onPress={() => {
                  bottomSheetModalRef.current?.dismiss();
                  handleSaveQr();
                }}
                className="flex-1 flex-row items-center p-4 bg-surface-secondary rounded-2xl border border-border"
                style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", borderWidth: 1 }}
              >
                <Download size={18} color={primaryColor} />
                <Button.Text className="ml-2">Galeria</Button.Text>
              </Button>
              <Button 
                variant="ghost"
                onPress={() => {
                  bottomSheetModalRef.current?.dismiss();
                  handleShareQr();
                }}
                className="flex-1 flex-row items-center p-4 bg-surface-secondary rounded-2xl border border-border"
                style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", borderWidth: 1 }}
              >
                <Share2 size={18} color={primaryColor} />
                <Button.Text className="ml-2">Compartilhar</Button.Text>
              </Button>
            </View>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tabIndicator: {
    position: "absolute",
    top: 5,
    bottom: 5,
    borderRadius: 999,
  }
});
