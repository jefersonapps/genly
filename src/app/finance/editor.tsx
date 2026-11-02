import { getTransactionColors } from "@/theme/finance";
import { getContrastSafeColor } from "@/components/editor/Editor";
import { Button } from "@/components/ui/Button";
import { KeyboardAvoidingView } from "@/components/ui/KeyboardAvoidingView";
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


  return (
    <KeyboardAvoidingView
      style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surface }}
      enabled={Platform.OS === "ios"}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4 py-2"
        style={[
          { backgroundColor: colors.surface },
        ]}
      >
        <View className="flex-row items-center flex-1 min-w-0 mr-3">
          <Button variant="icon" size="sm" onPress={() => router.back()} className="mr-1" style={{ minWidth: 44, minHeight: 44 }}>
            <Button.Icon
              icon={<ArrowLeft size={21} color={colors.text} />}
            />
          </Button>
          <Text className="font-sans-semibold text-lg ml-1 flex-1" numberOfLines={1} style={{ color: colors.text }}>
            {isEditing ? "Editar Transação" : "Nova Transação"}
          </Text>
        </View>

        <Button size="sm" rounded="full" onPress={handleSave} loading={saving} disabled={!dataLoaded} style={{ minHeight: 40, paddingHorizontal: 14 }} hitSlop={2}>
          <Button.Icon icon={<Check size={16} color="#FFF" />} />
          <Button.Text className="ml-2">Salvar</Button.Text>
        </Button>
      </View>

      <ScrollView 
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Compact segmented control */}
        <View className="flex-row p-1 rounded-xl border mb-5" style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
          {(['income', 'expense'] as const).map(value => {
            const selected = type === value;
            const palette = getTransactionColors(value, isDark);
            const Icon = value === 'income' ? TrendingUp : TrendingDown;
            return (
              <TouchableOpacity
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                activeOpacity={0.75}
                onPress={() => setType(value)}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-lg"
                style={{ minHeight: 40, paddingVertical: 8, borderWidth: 1,
                  backgroundColor: selected ? palette.background : 'transparent',
                  borderColor: selected ? palette.border : 'transparent' }}
              >
                <Icon size={16} strokeWidth={1.8} color={palette.text} />
                <Text className="font-sans-semibold text-sm" style={{ color: palette.text }}>
                  {value === 'income' ? 'Receita' : 'Despesa'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Title */}
        <View className="mb-4">
          <Text className="font-sans-medium text-xs mb-2" style={{ color: colors.textSecondary }}>Título</Text>
          <TextInput
            placeholder="Ex.: Compras do mercado"
            accessibilityLabel="Título da transação"
            placeholderTextColor={colors.placeholder}
            value={title}
            onChangeText={setTitle}
            className="font-sans text-base rounded-xl border"
            style={{ minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, color: colors.text,
              backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
          />
        </View>

        {/* Amount Section */}
        <View className="mb-5">
          <Text className="font-sans-medium text-xs mb-2" style={{ color: colors.textSecondary }}>Valor</Text>
          <View className="mb-2">
            <TextInput
              placeholder="R$ 0,00"
              placeholderTextColor={colors.placeholder}
              value={amountText}
              onChangeText={(t) => setAmountText(formatBRLInput(t))}
              keyboardType="numeric"
              editable={!isAmountUndefined}
              accessibilityLabel="Valor da transação"
              className="font-sans-semibold text-[22px] rounded-xl border"
              style={[
                {
                  color: isAmountUndefined ? colors.textSecondary : colors.text,
                  minHeight: 54, paddingHorizontal: 14, paddingVertical: 10,
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                  opacity: isAmountUndefined ? 0.5 : 1,
                },
              ]}
            />
          </View>

          <View className="flex-row items-center justify-between px-1"
            style={{ minHeight: 40 }}>
            <Text className="font-sans-medium text-xs" style={{ color: colors.textSecondary }}>
              Valor a definir
            </Text>
            <Switch
              accessibilityLabel="Valor a definir"
              style={{ transform: [{ scale: 0.85 }] }}
              value={isAmountUndefined}
              onValueChange={setIsAmountUndefined}
              trackColor={{ false: colors.surfaceTertiary, true: safeAccent + "60" }}
              thumbColor={isAmountUndefined ? safeAccent : colors.textSecondary}
            />
          </View>
        </View>

        {/* Description */}
        <View>
          <Text className="font-sans-medium text-xs mb-2" style={[{ color: colors.textSecondary }]}>
            Descrição (opcional)
          </Text>
          <TextInput
            placeholder="Adicionar descrição..."
            placeholderTextColor={colors.placeholder}
            value={description}
            onChangeText={setDescription}
            multiline
            accessibilityLabel="Descrição da transação"
            className="font-sans text-sm rounded-xl border"
            textAlignVertical="top"
            style={[
              {
                color: colors.text,
                minHeight: 96, paddingHorizontal: 14, paddingVertical: 12,
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
