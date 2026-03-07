import { SettingsRow } from "@/components/settings/SettingsRow";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { KeyboardAvoidingView } from "@/components/ui/KeyboardAvoidingView";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useDialog } from "@/providers/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { setSetting } from "@/services/settingsService";
import { copyToProfileDir, pickImages } from "@/utils/file";
import { Image } from "expo-image";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import { Shield } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SetupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { primaryColor, resolvedTheme } = useTheme();
  const dialog = useDialog();
  const isDark = resolvedTheme === "dark";
  const iconColor = primaryColor === "#000000" || primaryColor === "#000"
    ? (isDark ? "#FFF" : "#000")
    : primaryColor;

  const [profileName, setProfileName] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [securityEnabled, setSecurityEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [flexToggle, setFlexToggle] = useState(true);

  const { isVisible: isKeyboardVisible } = useKeyboard();

  useEffect(() => {
    setFlexToggle(!isKeyboardVisible);
  }, [isKeyboardVisible]);

  const handleProfileImage = async () => {
    try {
      const uris = await pickImages();
      if (uris.length > 0) {
        const newUri = await copyToProfileDir(uris[0]);
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
  };

  const handleContinue = async () => {
    if (!profileName.trim()) {
      dialog.show({ title: "Atenção", description: "Por favor, defina um nome para continuar." });
      return;
    }

    setIsSaving(true);
    try {
      await setSetting("profile_name", profileName.trim());
      if (profileImage) {
        await setSetting("profile_image", profileImage);
      }
      await setSetting("security_enabled", securityEnabled ? "1" : "0");
      await setSetting("has_completed_onboarding", "1");
      
      router.replace("/onboarding");
    } catch (e) {
      console.error(e);
      dialog.show({ title: "Erro", description: "Falha ao salvar as configurações." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[
        { backgroundColor: isDark ? "#0A0A0A" : "#FFFFFF" },
        flexToggle ? { flexGrow: 1 } : { flex: 1 }
      ]} 
      behavior="padding"
      keyboardVerticalOffset={20}
    >
      <ScrollView
        contentContainerStyle={{ 
            flexGrow: 1, 
            paddingTop: insets.top + 40, 
            paddingBottom: Math.max(insets.bottom + 24, 40),
            paddingHorizontal: 24
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center mb-10">
          <View className="h-24 w-24 mb-6 relative justify-center items-center">
             <Image 
                source={require("../../assets/adaptive-icon.png")}
                style={{ width: 100, height: 100 }}
                contentFit="contain"
             />
          </View>
          <Text className="font-sans-bold text-3xl text-on-surface text-center mb-3">
            Bem-vindo ao Genly
          </Text>
          <Text className="font-sans text-on-surface-secondary text-center leading-relaxed">
            Vamos configurar seu perfil para começar a usar o aplicativo.
          </Text>
        </View>

        <View className="items-center mb-8">
          <Avatar 
            uri={profileImage || undefined} 
            name={profileName || "User"} 
            size="lg" 
            onPress={handleProfileImage}
          />
          <Text className="mt-3 font-sans text-sm text-on-surface-secondary">
            Toque para alterar a foto
          </Text>
        </View>

        <View className="mb-8">
          <Input 
            label="Como você gostaria de ser chamado?"
            placeholder="Seu nome"
            value={profileName}
            onChangeText={setProfileName}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </View>

        <View className="overflow-hidden rounded-2xl bg-surface-secondary mb-10">
          <SettingsRow
            icon={<Shield size={20} color={iconColor} />}
            title="Segurança Biométrica"
            subtitle="Exigir biometria ao abrir o app"
            toggle={{
                value: securityEnabled,
                onValueChange: toggleSecurity
            }}
          />
        </View>

        <View className="flex-1 justify-end">
          <Button 
            variant="filled" 
            onPress={handleContinue}
            disabled={isSaving || !profileName.trim()}
            className="w-full py-4 rounded-full"
          >
             <Button.Text className="font-sans-bold text-lg">
                {isSaving ? "Salvando..." : "Começar a usar"}
             </Button.Text>
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
