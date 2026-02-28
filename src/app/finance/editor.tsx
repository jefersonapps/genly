import { getContrastSafeColor } from "@/components/editor/Editor";
import { Button } from "@/components/ui/Button";
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
    StyleSheet,
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

  const isIncome = type === "income";
  const typeColor = isIncome ? "#22C55E" : "#EF4444";

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, backgroundColor: colors.surface },
      ]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <View style={styles.headerLeft}>
          <Button variant="icon" onPress={() => router.back()} className="mr-1">
            <Button.Icon
              icon={<ArrowLeft size={24} color={colors.text} />}
            />
          </Button>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isEditing ? "Editar Transação" : "Nova Transação"}
          </Text>
        </View>

        <Button rounded="full" onPress={handleSave} loading={saving}>
          <Button.Icon icon={<Check size={18} color="#FFF" />} />
          <Button.Text className="ml-2">Salvar</Button.Text>
        </Button>
      </View>

      <View style={styles.content}>
        {/* Type Toggle */}
        <View style={styles.typeRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setType("income")}
            style={[
              styles.typeBtn,
              {
                backgroundColor: isIncome ? "#22C55E18" : colors.surfaceSecondary,
                borderColor: isIncome ? "#22C55E50" : colors.border,
              },
            ]}
          >
            <TrendingUp size={18} color={isIncome ? "#22C55E" : colors.textSecondary} />
            <Text
              style={[
                styles.typeLabel,
                { color: isIncome ? "#22C55E" : colors.textSecondary },
              ]}
            >
              Receita
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setType("expense")}
            style={[
              styles.typeBtn,
              {
                backgroundColor: !isIncome ? "#EF444418" : colors.surfaceSecondary,
                borderColor: !isIncome ? "#EF444450" : colors.border,
              },
            ]}
          >
            <TrendingDown size={18} color={!isIncome ? "#EF4444" : colors.textSecondary} />
            <Text
              style={[
                styles.typeLabel,
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
          style={[styles.titleInput, { color: colors.text }]}
        />

        {/* Amount Section */}
        <View style={styles.amountSection}>
          <View style={styles.amountRow}>
            <TextInput
              placeholder="R$ 0,00"
              placeholderTextColor={colors.placeholder}
              value={amountText}
              onChangeText={(t) => setAmountText(formatBRLInput(t))}
              keyboardType="numeric"
              editable={!isAmountUndefined}
              style={[
                styles.amountInput,
                {
                  color: isAmountUndefined ? colors.textSecondary : typeColor,
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                  opacity: isAmountUndefined ? 0.5 : 1,
                },
              ]}
            />
          </View>

          <View style={styles.undefinedRow}>
            <Text style={[styles.undefinedLabel, { color: colors.textSecondary }]}>
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
        <View style={[styles.descriptionSection, { borderColor: colors.border }]}>
          <Text style={[styles.descLabel, { color: colors.textSecondary }]}>
            Descrição (opcional)
          </Text>
          <TextInput
            placeholder="Adicionar descrição..."
            placeholderTextColor={colors.placeholder}
            value={description}
            onChangeText={setDescription}
            multiline
            style={[
              styles.descInput,
              {
                color: colors.text,
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  headerTitle: { fontWeight: "700", fontSize: 20, marginLeft: 4 },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  typeRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  typeLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  titleInput: {
    fontWeight: "800",
    fontSize: 26,
    marginBottom: 20,
  },
  amountSection: {
    marginBottom: 20,
  },
  amountRow: {
    marginBottom: 12,
  },
  amountInput: {
    fontSize: 28,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  undefinedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  undefinedLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  descriptionSection: {
    borderTopWidth: 1,
    paddingTop: 16,
  },
  descLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  descInput: {
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 120,
    textAlignVertical: "top",
  },
});
