import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { KeyboardAvoidingView } from "@/components/ui/KeyboardAvoidingView";
import { useDialog } from "@/providers/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import {
    getSetting,
    setSetting,
} from "@/services/settingsService";
import { useRouter } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { ArrowLeft, Bot, Check, Info, KeyRound } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AIConfigScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { primaryColor, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const dialog = useDialog();

  const [geminiKey, setGeminiKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("");
  const [openaiModel, setOpenaiModel] = useState("");
  const [activeModel, setActiveModel] = useState<"gemini" | "openai">("gemini");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const gKey = await getSetting("gemini_api_key");
      const oKey = await getSetting("openai_api_key");
      const gModel = await getSetting("gemini_model");
      const oModel = await getSetting("openai_model");
      const model = await getSetting("active_model");

      setGeminiKey(gKey || "");
      setOpenaiKey(oKey || "");
      setGeminiModel(gModel || "");
      setOpenaiModel(oModel || "");
      setActiveModel((model as "gemini" | "openai") || "gemini");
    } catch {
      dialog.show({
        title: "Erro",
        description: "Falha ao carregar configurações.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setSetting("gemini_api_key", geminiKey.trim());
      await setSetting("openai_api_key", openaiKey.trim());
      await setSetting("gemini_model", geminiModel.trim());
      await setSetting("openai_model", openaiModel.trim());
      await setSetting("active_model", activeModel);
      // dialog.show({ title: "Sucesso", description: "Configurações salvas!" });
      router.back();
    } catch {
      dialog.show({ title: "Erro", description: "Falha ao salvar." });
    } finally {
      setSaving(false);
    }
  };

  const colors = {
    text: isDark ? "#FAFAFA" : "#18181B",
    textSecondary: isDark ? "#A1A1AA" : "#71717A",
    surface: isDark ? "#0A0A0A" : "#FFFFFF",
    surfaceSecondary: isDark ? "#171717" : "#F5F5F5",
    border: isDark ? "#262626" : "#E5E5E5",
    inputBg: isDark ? "#171717" : "#e5e5e540",
    primary: primaryColor,
  };

  return (
    <View
      className="flex-1"
      style={{
        backgroundColor: colors.surface,
        paddingTop: insets.top,
      }}
    >
      <View
        className="flex-row items-center justify-between px-5 py-3 border-b"
        style={{
          borderBottomColor: colors.border,
        }}
      >
        <Button variant="icon" onPress={() => router.back()}>
          <Button.Icon icon={<ArrowLeft size={24} color={colors.text} />} />
        </Button>
        <Text
          className="text-lg font-sans-bold"
          style={{
            color: colors.text,
          }}
        >
          Inteligência Artificial
        </Text>
        <Button
          rounded="full"
          loading={saving}
          onPress={handleSave}
          disabled={loading}
        >
          <Button.Icon icon={<Check size={18} color="#FFF" />} />
          <Button.Text className="ml-2">Salvar</Button.Text>
        </Button>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>
          <View>
            <View
              className="flex-row items-center gap-x-3 mb-5 p-4 rounded-xl"
              style={{
                backgroundColor: colors.surfaceSecondary,
              }}
            >
              <Info size={24} color={colors.primary} />
              <Text className="flex-1 text-sm font-sans" style={{ color: colors.textSecondary }}>
                Configure as chaves e modelos para habilitar a IA no editor.
                Digite o nome exato do modelo (sem espaços).
              </Text>
            </View>

            {/* Model Selection */}
            <Text className="text-base font-sans-semibold mb-3" style={{ color: colors.text }}>
              Modelo Ativo
            </Text>
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <TouchableOpacity
                onPress={() => setActiveModel("gemini")}
                activeOpacity={0.8}
                className="flex-1 p-4 rounded-xl border-2 items-center justify-center relative"
                style={[
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor:
                      activeModel === "gemini" ? colors.primary : "transparent",
                  },
                ]}
              >
                <Bot
                  size={24}
                  color={activeModel === "gemini" ? colors.primary : colors.textSecondary}
                />
                <Text
                  className="mt-2 font-sans-semibold"
                  style={{
                    color: activeModel === "gemini" ? colors.primary : colors.text,
                  }}
                >
                  Google Gemini
                </Text>
                {activeModel === "gemini" && (
                   <View className="absolute top-2 right-2 w-5 h-5 rounded-full items-center justify-center" style={[{ backgroundColor: colors.primary }]}>
                       <Check size={12} color={colors.surface === "#FFFFFF" || colors.surface === "#FFF" ? "#FFFFFF" : "#000000"} />
                   </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveModel("openai")}
                activeOpacity={0.8}
                className="flex-1 p-4 rounded-xl border-2 items-center justify-center relative"
                style={[
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor:
                      activeModel === "openai" ? colors.primary : "transparent",
                  },
                ]}
              >
                <Bot
                  size={24}
                  color={activeModel === "openai" ? colors.primary : colors.textSecondary}
                />
                <Text
                  className="mt-2 font-sans-semibold"
                  style={{
                    color: activeModel === "openai" ? colors.primary : colors.text,
                  }}
                >
                  OpenAI GPT
                </Text>
                {activeModel === "openai" && (
                   <View className="absolute top-2 right-2 w-5 h-5 rounded-full items-center justify-center" style={[{ backgroundColor: colors.primary }]}>
                       <Check size={12} color={colors.surface === "#FFFFFF" || colors.surface === "#FFF" ? "#FFFFFF" : "#000000"} />
                   </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Gemini Config */}
            <View className="mb-6">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm font-sans-medium" style={[{ color: colors.text }]}>
                  Chave API Gemini
                </Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() =>
                    openBrowserAsync("https://aistudio.google.com/app/apikey")
                  }
                >
                  <Text className="text-xs font-sans" style={{ color: colors.primary }}>
                    Obter chave
                  </Text>
                </TouchableOpacity>
              </View>
              <View
                className="flex-row items-center border rounded-xl px-3 h-12"
                style={[{ backgroundColor: colors.inputBg, borderColor: colors.border }]}
              >
                <KeyRound size={18} color={colors.textSecondary} />
                <TextInput
                  className="flex-1 ml-2.5 text-base font-sans"
                  style={[{ color: colors.text }]}
                  placeholder="Cole sua chave aqui..."
                  placeholderTextColor={colors.textSecondary}
                  value={geminiKey}
                  onChangeText={setGeminiKey}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm font-sans-medium mt-3" style={[{ color: colors.text }]}>
                  Modelo
                </Text>
              </View>
              <View
                className="flex-row items-center border rounded-xl px-3 h-12"
                style={[{ backgroundColor: colors.inputBg, borderColor: colors.border }]}
              >
                <Bot size={18} color={colors.textSecondary} />
                <TextInput
                  className="flex-1 ml-2.5 text-base font-sans"
                  style={[{ color: colors.text }]}
                  placeholder="Nome do modelo..."
                  placeholderTextColor={colors.textSecondary}
                  value={geminiModel}
                  onChangeText={setGeminiModel}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={{ marginBottom: 24, opacity: 0.5 }}>
                 <Divider />
            </View>

            {/* OpenAI Config */}
            <View className="mb-6">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm font-sans-medium" style={[{ color: colors.text }]}>
                  Chave API OpenAI
                </Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() =>
                    openBrowserAsync("https://platform.openai.com/api-keys")
                  }
                >
                  <Text className="text-xs font-sans" style={{ color: colors.primary }}>
                    Obter chave
                  </Text>
                </TouchableOpacity>
              </View>
              <View
                className="flex-row items-center border rounded-xl px-3 h-12"
                style={[{ backgroundColor: colors.inputBg, borderColor: colors.border }]}
              >
                <KeyRound size={18} color={colors.textSecondary} />
                <TextInput
                  className="flex-1 ml-2.5 text-base font-sans"
                  style={[{ color: colors.text }]}
                  placeholder="Cole sua chave aqui..."
                  placeholderTextColor={colors.textSecondary}
                  value={openaiKey}
                  onChangeText={setOpenaiKey}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <View className="flex-row justify-between items-center mb-2">
                 <Text className="text-sm font-sans-medium mt-3" style={[{ color: colors.text }]}>
                  Modelo
                </Text>
              </View>
              <View
                className="flex-row items-center border rounded-xl px-3 h-12"
                style={[{ backgroundColor: colors.inputBg, borderColor: colors.border }]}
              >
                <Bot size={18} color={colors.textSecondary} />
                <TextInput
                  className="flex-1 ml-2.5 text-base font-sans"
                  style={[{ color: colors.text }]}
                  placeholder="Nome do modelo..."
                  placeholderTextColor={colors.textSecondary}
                  value={openaiModel}
                  onChangeText={setOpenaiModel}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
