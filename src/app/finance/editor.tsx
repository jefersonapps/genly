import { getContrastSafeColor } from "@/components/editor/Editor";
import { Button } from "@/components/ui/Button";
import { KeyboardAvoidingView } from "@/components/ui/KeyboardAvoidingView";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useDialog } from "@/providers/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import {
    createTransaction,
    getTransactionById,
    updateTransaction,
    type TransactionType,
} from "@/services/financeService";
import {
    extractCentsFromInput,
    formatBRL,
    formatBRLInput,
} from "@/utils/currency";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Check, TrendingDown, TrendingUp } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    Platform,
    ScrollView,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TransactionEditor() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string;
    type?: string;
  }>();
  const { primaryColor, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const safeAccent = getContrastSafeColor(primaryColor, isDark);
  const dialog = useDialog();

  const isEditing = !!params.id;
  const transactionId = params.id ? parseInt(params.id) : null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<TransactionType>(
    (params.type as TransactionType) || "expense"
  );
  const [amountText, setAmountText] = useState("");
  const [isAmountUndefined, setIsAmountUndefined] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(!isEditing);

  const { isVisible: isKeyboardVisible } = useKeyboard();
  const [flexToggle, setFlexToggle] = useState(true);

  useEffect(() => {
    setFlexToggle(!isKeyboardVisible);
  }, [isKeyboardVisible]);

  const colors = {
    text: isDark ? "#FAFAFA" : "#18181B",
    textSecondary: isDark ? "#A1A1AA" : "#71717A",
    surface: isDark ? "#0A0A0A" : "#FFFFFF",
    surfaceSecondary: isDark ? "#171717" : "#F5F5F5",
    surfaceTertiary: isDark ? "#262626" : "#E4E4E7",
    border: isDark ? "#262626" : "#E5E5E5",
    placeholder: isDark ? "#52525B" : "#A1A1AA",
  };

  // Load existing transaction
  useEffect(() => {
    if (!transactionId) return;
    (async () => {
      const t = await getTransactionById(transactionId);
      if (t) {
        setTitle(t.title);
        setDescription(t.description || "");
        setType(t.type as TransactionType);
        setIsAmountUndefined(!!t.isAmountUndefined);
        if (!t.isAmountUndefined && t.amount > 0) {
          setAmountText(formatBRL(t.amount));
        }
      }
      setDataLoaded(true);
    })();
  }, [transactionId]);

  const handleSave = async () => {
    if (!title.trim()) {
      dialog.show({ title: "Erro", description: "O título é obrigatório." });
      return;
    }

    if (!isAmountUndefined && !amountText.trim()) {
      dialog.show({
        title: "Erro",
        description:
          'Informe o valor ou marque como "Valor a definir".',
      });
      return;
    }

    setSaving(true);
    try {
      const amount = isAmountUndefined ? 0 : extractCentsFromInput(amountText);

      // Try to get HTML from the editor ref if available
      let finalDescription = description;

      if (isEditing && transactionId) {
        await updateTransaction(transactionId, {
          title,
          description: finalDescription,
          amount,
          type,
          isAmountUndefined,
        });
      } else {
        await createTransaction(
          title,
          type,
          amount,
          isAmountUndefined,
          finalDescription
        );
      }
      router.back();
    } catch (e) {
      dialog.show({ title: "Erro", description: "Falha ao salvar a transação." });
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const isIncome = type === "income";
  const typeColor = isIncome ? "#22C55E" : "#EF4444";

  return (
    <KeyboardAvoidingView
      className="flex-1"
      style={[
        { paddingTop: insets.top, backgroundColor: colors.surface },
        flexToggle ? { flexGrow: 1 } : { flex: 1 }
      ]}
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
    >
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4 py-3 border-b"
        style={[
          { borderBottomColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <View className="flex-row items-center flex-1">
          <Button variant="icon" onPress={() => router.back()} className="mr-1">
            <Button.Icon
              icon={<ArrowLeft size={24} color={colors.text} />}
            />
          </Button>
          <Text className="font-sans-bold text-xl ml-1" style={[{ color: colors.text }]}>
            {isEditing ? "Editar Transação" : "Nova Transação"}
          </Text>
        </View>

        <Button rounded="full" onPress={handleSave} loading={saving}>
          <Button.Icon icon={<Check size={18} color="#FFF" />} />
          <Button.Text className="ml-2">Salvar</Button.Text>
        </Button>
      </View>

      <ScrollView 
        contentContainerStyle={[{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: flexToggle ? 40 : 100 }]} 
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Type Toggle */}
        <View className="flex-row gap-3 mb-5">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setType("income")}
            className="flex-1 flex-row items-center justify-center gap-2 py-[14px] rounded-2xl border"
            style={[
              {
                backgroundColor: isIncome ? "#22C55E18" : colors.surfaceSecondary,
                borderColor: isIncome ? "#22C55E50" : colors.border,
              },
            ]}
          >
            <TrendingUp size={18} color={isIncome ? "#22C55E" : colors.textSecondary} />
            <Text
              className="font-sans-bold text-[15px]"
              style={[
                { color: isIncome ? "#22C55E" : colors.textSecondary },
              ]}
            >
              Receita
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setType("expense")}
            className="flex-1 flex-row items-center justify-center gap-2 py-[14px] rounded-2xl border"
            style={[
              {
                backgroundColor: !isIncome ? "#EF444418" : colors.surfaceSecondary,
                borderColor: !isIncome ? "#EF444450" : colors.border,
              },
            ]}
          >
            <TrendingDown size={18} color={!isIncome ? "#EF4444" : colors.textSecondary} />
            <Text
              className="font-sans-bold text-[15px]"
              style={[
                { color: !isIncome ? "#EF4444" : colors.textSecondary },
              ]}
            >
              Despesa
            </Text>
          </TouchableOpacity>
        </View>

        {/* Title */}
        <TextInput
          placeholder="Título da transação"
          placeholderTextColor={colors.placeholder}
          value={title}
          onChangeText={setTitle}
          className="font-sans-extrabold text-[26px] mb-5"
          style={[{ color: colors.text }]}
        />

        {/* Amount Section */}
        <View className="mb-5">
          <View className="mb-3">
            <TextInput
              placeholder="R$ 0,00"
              placeholderTextColor={colors.placeholder}
              value={amountText}
              onChangeText={(t) => setAmountText(formatBRLInput(t))}
              keyboardType="numeric"
              editable={!isAmountUndefined}
              className="font-sans-bold text-[28px] px-4 py-[14px] rounded-2xl border"
              style={[
                {
                  color: isAmountUndefined ? colors.textSecondary : typeColor,
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                  opacity: isAmountUndefined ? 0.5 : 1,
                },
              ]}
            />
          </View>

          <View className="flex-row items-center justify-between px-1">
            <Text className="font-sans-semibold text-sm" style={[{ color: colors.textSecondary }]}>
              Valor a definir
            </Text>
            <Switch
              value={isAmountUndefined}
              onValueChange={setIsAmountUndefined}
              trackColor={{ false: colors.surfaceTertiary, true: safeAccent + "60" }}
              thumbColor={isAmountUndefined ? safeAccent : colors.textSecondary}
            />
          </View>
        </View>

        {/* Description */}
        <View className="border-t pt-4" style={[{ borderColor: colors.border }]}>
          <Text className="font-sans-bold text-xs uppercase tracking-widest mb-2" style={[{ color: colors.textSecondary }]}>
            Descrição (opcional)
          </Text>
          <TextInput
            placeholder="Adicionar descrição..."
            placeholderTextColor={colors.placeholder}
            value={description}
            onChangeText={setDescription}
            multiline
            className="font-sans text-base px-4 py-[14px] rounded-2xl border min-h-[120px]"
            textAlignVertical="top"
            style={[
              {
                color: colors.text,
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
