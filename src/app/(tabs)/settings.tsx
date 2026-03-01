import { SettingsRow } from "@/components/settings/SettingsRow";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { TabHeader } from "@/components/ui/TabHeader";
import { useDialog } from "@/providers/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { exportBackup, importBackup } from "@/services/backupService";
import {
    getSetting,
    setSetting,
} from "@/services/settingsService";
import { copyToProfileDir, pickImages } from "@/utils/file";
import {
    BottomSheetBackdrop,
    BottomSheetModal,
    BottomSheetView
} from "@gorhom/bottom-sheet";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
    Download,
    FolderPlus,
    Palette,
    Share2,
    Shield,
    Sparkles,
    Upload
} from "lucide-react-native";
import React, { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, {
    useAnimatedScrollHandler, useSharedValue
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { themeMode, setThemeMode, primaryColor, resolvedTheme } = useTheme();

  const isDark = resolvedTheme === "dark";
  const dialog = useDialog();
  const iconColor = primaryColor === "#000000" || primaryColor === "#000" 
    ? (isDark ? "#FFF" : "#000") 
    : primaryColor;

  const [profileName, setProfileName] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [securityEnabled, setSecurityEnabled] = useState(false);
  const [exportPath, setExportPath] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = React.useMemo(() => ["35%"], []);

  const loadSettings = useCallback(async () => {
    const name = await getSetting("profile_name");
    const img = await getSetting("profile_image");
    const sec = await getSetting("security_enabled");
    setProfileName(name);
    setProfileImage(img);
    setSecurityEnabled(sec === "1");
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const handleProfileImage = async () => {
    try {
      const uris = await pickImages();
      if (uris.length > 0) {
        const newUri = await copyToProfileDir(uris[0]);
        await setSetting("profile_image", newUri);
        setProfileImage(newUri);
      }
    } catch (e) {
      dialog.show({ title: "Erro", description: "Não foi possível atualizar a imagem de perfil." });
    }
  };

  const toggleSecurity = async (value: boolean) => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      dialog.show({ title: "Erro", description: "Este dispositivo não suporta autenticação biométrica." });
      return;
    }
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      dialog.show({ title: "Erro", description: "Nenhuma biometria cadastrada no dispositivo." });
      return;
    }

    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: value 
        ? "Confirme sua identidade para ativar a segurança" 
        : "Confirme sua identidade para desativar a segurança",
    });

    if (!auth.success) return;
    
    setSecurityEnabled(value);
    await setSetting("security_enabled", value ? "1" : "0");
  };

  const handleExport = async () => {
    if (securityEnabled) {
       const auth = await LocalAuthentication.authenticateAsync({ promptMessage: "Autenticar para exportar backup" });
       if (!auth.success) return;
    }
    
    setIsExporting(true);
    try {
      const path = await exportBackup();
      setExportPath(path);
      bottomSheetModalRef.current?.present();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.error(e);
      dialog.show({ title: "Erro", description: "Falha ao exportar backup." });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveToFolder = async () => {
    if (!exportPath) return;
    
    try {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permissions.granted) return;

      const filename = exportPath.split('/').pop() || "genly_backup.zip";
      const destinationUri = await FileSystem.StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        filename,
        "application/zip"
      );

      const content = await FileSystem.readAsStringAsync(exportPath, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await FileSystem.writeAsStringAsync(destinationUri, content, {
        encoding: FileSystem.EncodingType.Base64,
      });

      bottomSheetModalRef.current?.dismiss();
      dialog.show({ title: "Sucesso", description: "Backup salvo com sucesso!" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error(e);
      dialog.show({ title: "Erro", description: "Falha ao salvar o arquivo." });
    }
  };

  const handleShareExport = async () => {
    if (!exportPath) return;
    try {
      await Sharing.shareAsync(exportPath, {
        mimeType: "application/zip",
        dialogTitle: "Exportar backup do Genly",
      });
      bottomSheetModalRef.current?.dismiss();
    } catch (e) {
      console.error(e);
      dialog.show({ title: "Erro", description: "Falha ao compartilhar o arquivo." });
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

  const handleImport = async () => {
    if (securityEnabled) {
       const auth = await LocalAuthentication.authenticateAsync({ promptMessage: "Autenticar para importar backup" });
       if (!auth.success) return;
    }
    
    dialog.show({
      title: "Atenção",
      description: "Isso substituirá todos os dados atuais. Deseja continuar?",
      buttons: [
        { text: "Cancelar", variant: "ghost" },
        {
          text: "Importar",
          variant: "destructive",
          onPress: async () => {
            try {
              await importBackup();
              dialog.show({ title: "Sucesso", description: "Backup restaurado!" });
              router.replace("/");
            } catch (e) {
              dialog.show({ title: "Erro", description: "Falha ao importar backup." });
            }
          },
        },
      ],
    });
  };

  return (
    <View className="flex-1 bg-surface">
      {/* Floating Header */}
      <TabHeader
        scrollY={scrollY}
        title="Ajustes"
        titleThreshold={[40, 60]}
        hasSlideIn
      />

      <Animated.ScrollView 
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ 
            paddingTop: insets.top + 16,
            paddingBottom: 100 
        }}
      >
        {/* Static Title */}
        <View className="px-6 mb-6">
           <Text className="font-sans-bold text-3xl text-on-surface mt-1">Ajustes</Text>
        </View>
        {/* Profile Header */}
        <View className="items-center py-6">
          <Avatar 
            uri={profileImage || undefined} 
            name={profileName || "User"} 
            size="lg" 
            onPress={handleProfileImage}
          />
          <Text className="mt-3 font-sans-bold text-xl text-on-surface">
             {profileName || "Seu Nome"}
          </Text>
          <Button 
            variant="ghost" 
            size="sm" 
            onPress={() => {
                dialog.show({
                    title: "Nome de perfil",
                    description: "Como você gostaria de ser chamado?",
                    prompt: {
                        defaultValue: profileName,
                        placeholder: "Seu nome",
                        onConfirm: async (newName) => {
                            if (newName.trim()) {
                                await setSetting("profile_name", newName.trim());
                                setProfileName(newName.trim());
                            }
                        }
                    },
                    buttons: [
                        { text: "Cancelar", variant: "ghost" },
                        { text: "Confirmar", variant: "default" }
                    ]
                });
            }} 
            className="mt-1"
          >
            <Button.Text>Editar Perfil</Button.Text>
          </Button>
        </View>

        <View className="px-5 pb-2">
            <Text className="font-sans-bold text-lg text-on-surface mb-2">Geral</Text>
        </View>
        <View className="mx-5 overflow-hidden rounded-2xl bg-surface-secondary">
          <SettingsRow
            icon={<Palette size={20} color={iconColor} />}
            title="Aparência"
            subtitle={`Modo: ${themeMode === 'system' ? 'Automático' : themeMode === 'dark' ? 'Escuro' : 'Claro'}`}
            showChevron
            onPress={() => router.push("/settings/appearance")}
          />
          <Divider className="opacity-50" />
          <SettingsRow
            icon={<Shield size={20} color={iconColor} />}
            title="Segurança Biométrica"
            subtitle="Exigir senha ao abrir o app"
            toggle={{
                value: securityEnabled,
                onValueChange: toggleSecurity
            }}
          />
          <Divider className="opacity-50" />
           <SettingsRow
            icon={<Sparkles size={20} color={iconColor} />}
            title="Inteligência Artificial"
            subtitle="Configurar chaves e modelos"
            showChevron
            onPress={() => router.push("/settings/ai-config")}
          />
        </View>

        <View className="px-5 pb-2 mt-6">
            <Text className="font-sans-bold text-lg text-on-surface mb-2">Dados</Text>
        </View>
        <View className="mx-5 overflow-hidden rounded-2xl bg-surface-secondary">
           <SettingsRow
            icon={<Download size={20} color={iconColor} />}
            title="Exportar Backup"
            subtitle={isExporting ? "Gerando arquivo..." : "Salvar tarefas e mídias"}
            onPress={handleExport}
            disabled={isExporting}
          />
          <Divider className="opacity-50" />
           <SettingsRow
            icon={<Upload size={20} color={iconColor} />}
            title="Importar Backup"
            subtitle="Restaurar de um arquivo"
            onPress={handleImport}
          />
        </View>

      </Animated.ScrollView>

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
            Exportar Backup
          </Text>

          <View className="gap-3">
            <Button 
              variant="ghost"
              onPress={handleSaveToFolder}
              className="flex-row items-center p-4 bg-surface-secondary rounded-2xl border border-border"
              style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", borderWidth: 1 }}
            >
              <View className="h-10 w-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: primaryColor + "15" }}>
                <FolderPlus size={20} color={primaryColor} />
              </View>
              <View className="flex-1">
                <Text className="font-sans-bold text-on-surface">Salvar em Pasta</Text>
                <Text className="font-sans text-xs text-on-surface-secondary">Escolher diretório local</Text>
              </View>
            </Button>

            <Button 
              variant="ghost"
              onPress={handleShareExport}
              className="flex-row items-center p-4 bg-surface-secondary rounded-2xl border border-border"
              style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", borderWidth: 1 }}
            >
              <View className="h-10 w-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: primaryColor + "15" }}>
                <Share2 size={20} color={primaryColor} />
              </View>
              <View className="flex-1">
                <Text className="font-sans-bold text-on-surface">Compartilhar</Text>
                <Text className="font-sans text-xs text-on-surface-secondary">Enviar para outro app</Text>
              </View>
            </Button>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}
