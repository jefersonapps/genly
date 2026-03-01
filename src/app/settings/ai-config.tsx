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
    StyleSheet, Text,
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
  const [geminiModel, setGeminiModel] = useState("gemini-3-flash-preview");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini");
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
      setGeminiModel(gModel || "gemini-3-flash-preview");
      setOpenaiModel(oModel || "gpt-4o-mini");
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
      dialog.show({ title: "Sucesso", description: "Configurações salvas!" });
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
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        paddingTop: insets.top,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Button variant="icon" onPress={() => router.back()}>
          <Button.Icon icon={<ArrowLeft size={24} color={colors.text} />} />
        </Button>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "bold",
            color: colors.text,
          }}
        >
          Inteligência Artificial
        </Text>
        <Button
          variant="ghost"
          loading={saving}
          onPress={handleSave}
          disabled={loading}
        >
          <Button.Icon icon={<Check size={20} color={colors.primary} />} />
        </Button>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>
          <View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 20,
                backgroundColor: colors.surfaceSecondary,
                padding: 16,
                borderRadius: 12,
              }}
            >
              <Info size={24} color={colors.primary} style={{ marginRight: 12 }} />
              <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 14 }}>
                Configure as chaves e modelos para habilitar a IA no editor.
                Digite o nome exato do modelo (sem espaços).
              </Text>
            </View>

            {/* Model Selection */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
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
                activeOpacity={0.7}
                style={[
                  styles.modelCard,
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
                  style={{
                    marginTop: 8,
                    fontWeight: "600",
                    color: activeModel === "gemini" ? colors.primary : colors.text,
                  }}
                >
                  Google Gemini
                </Text>
                {activeModel === "gemini" && (
                   <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                       <Check size={12} color={colors.surface === "#FFFFFF" || colors.surface === "#FFF" ? "#FFFFFF" : "#000000"} />
                   </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveModel("openai")}
                activeOpacity={0.7}
                style={[
                  styles.modelCard,
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
                  style={{
                    marginTop: 8,
                    fontWeight: "600",
                    color: activeModel === "openai" ? colors.primary : colors.text,
                  }}
                >
                  OpenAI GPT
                </Text>
                {activeModel === "openai" && (
                   <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                       <Check size={12} color={colors.surface === "#FFFFFF" || colors.surface === "#FFF" ? "#FFFFFF" : "#000000"} />
                   </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Gemini Config */}
            <View style={{ marginBottom: 24 }}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.text }]}>
                  Chave API Gemini
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    openBrowserAsync("https://aistudio.google.com/app/apikey")
                  }
                >
                  <Text style={{ color: colors.primary, fontSize: 12 }}>
                    Obter chave
                  </Text>
                </TouchableOpacity>
              </View>
              <View
                style={[
                  styles.inputContainer,
                  { backgroundColor: colors.inputBg, borderColor: colors.border },
                ]}
              >
                <KeyRound size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Cole sua chave aqui..."
                  placeholderTextColor={colors.textSecondary}
                  value={geminiKey}
                  onChangeText={setGeminiKey}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.text, marginTop: 12 }]}>
                  Modelo
                </Text>
              </View>
              <View
                style={[
                  styles.inputContainer,
                  { backgroundColor: colors.inputBg, borderColor: colors.border },
                ]}
              >
                <Bot size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
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
            <View style={{ marginBottom: 24 }}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.text }]}>
                  Chave API OpenAI
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    openBrowserAsync("https://platform.openai.com/api-keys")
                  }
                >
                  <Text style={{ color: colors.primary, fontSize: 12 }}>
                    Obter chave
                  </Text>
                </TouchableOpacity>
              </View>
              <View
                style={[
                  styles.inputContainer,
                  { backgroundColor: colors.inputBg, borderColor: colors.border },
                ]}
              >
                <KeyRound size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Cole sua chave aqui..."
                  placeholderTextColor={colors.textSecondary}
                  value={openaiKey}
                  onChangeText={setOpenaiKey}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.labelRow}>
                 <Text style={[styles.label, { color: colors.text, marginTop: 12 }]}>
                  Modelo
                </Text>
              </View>
              <View
                style={[
                  styles.inputContainer,
                  { backgroundColor: colors.inputBg, borderColor: colors.border },
                ]}
              >
                <Bot size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
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

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  modelCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
});
