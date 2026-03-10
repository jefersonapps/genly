import { SettingsRow } from "@/components/settings/SettingsRow";
import { Avatar } from "@/components/ui/Avatar";
import BottomSheet from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { TabHeader } from "@/components/ui/TabHeader";
import { useHeaderSnap } from "@/hooks/useHeaderSnap";
import { useDialog } from "@/providers/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { exportBackup, importBackup } from "@/services/backupService";
import {
  getSetting,
  setSetting,
} from "@/services/settingsService";
import { withOpacity } from "@/utils/colors";
import { copyToProfileDir, pickImages } from "@/utils/file";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  Compass,
  Download,
  FolderPlus,
  Palette,
  RefreshCw,
  Share2,
  Shield,
  Sparkles,
  Upload
} from "lucide-react-native";
import React, { useCallback, useRef, useState } from "react";
import { Linking, Text, View } from "react-native";
import Animated from "react-native-reanimated";
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

  const { headerScrollY, scrollHandler } = useHeaderSnap({ snapThreshold: 60 });

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

  // renderBackdrop removed, handled by BottomSheet component

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
        scrollY={headerScrollY}
        title="Ajustes"
        titleThreshold={[40, 60]}
        hasSlideIn
      />

      <Animated.ScrollView 
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ 
            paddingTop: 0,
            paddingBottom: 120 
        }}
      >
        <View style={{ height: insets.top + 16 }} />

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

        <View className="px-5 pb-2 mt-6">
            <Text className="font-sans-bold text-lg text-on-surface mb-2">Sobre</Text>
        </View>
        <View className="mx-5 overflow-hidden rounded-2xl bg-surface-secondary">
           <SettingsRow
            icon={<RefreshCw size={20} color={iconColor} />}
            title="Atualizações"
            subtitle="Buscar nova versão"
            showChevron
            onPress={() => router.push("/settings/updates")}
          />
           <Divider className="opacity-50" />
           <SettingsRow
            icon={<Compass size={20} color={iconColor} />}
            title="Guia de Boas-vindas"
            subtitle="Rever o tutorial do aplicativo"
            onPress={() => router.push("/onboarding")}
          />
        </View>

        {/* Footer */}
        <View className="items-center mt-12 mb-8">
            <Text className="font-sans text-sm text-on-surface-secondary">
                Developed by{" "}
                <Text 
                    className="font-sans-bold text-primary" 
                    onPress={() => Linking.openURL("https://github.com/jefersonapps")}
                >
                    jefersonapps
                </Text>
            </Text>
        </View>

      </Animated.ScrollView>

      <BottomSheet
        sheetRef={bottomSheetModalRef}
        snapPoints={snapPoints}
      >
        <BottomSheet.View>
          <BottomSheet.Header title="Exportar Backup" />

          <BottomSheet.ItemGroup>
            <BottomSheet.Item
              icon={<FolderPlus size={20} color={primaryColor} />}
              iconBackgroundColor={withOpacity(primaryColor, 0.08)}
              title="Salvar em Pasta"
              subtitle="Escolher diretório local"
              onPress={handleSaveToFolder}
            />
            <BottomSheet.Separator />
            <BottomSheet.Item
              icon={<Share2 size={20} color={primaryColor} />}
              iconBackgroundColor={withOpacity(primaryColor, 0.08)}
              title="Compartilhar"
              subtitle="Enviar para outro app"
              onPress={handleShareExport}
            />
          </BottomSheet.ItemGroup>
        </BottomSheet.View>
      </BottomSheet>
    </View>
  );
}
