import { getContrastSafeColor } from "@/components/editor/Editor";
import { BalanceChart } from "@/components/finance/BalanceChart";
import { Button } from "@/components/ui/Button";
import { CardGradient } from "@/components/ui/CardGradient";
import { TabHeader } from "@/components/ui/TabHeader";
import type { Transaction } from "@/db/schema";
import { useHeaderSnap } from "@/hooks/useHeaderSnap";
import { useDialog } from "@/providers/DialogProvider";
import { useTheme } from "@/providers/ThemeProvider";
import {
  deleteTransaction,
  getAllTransactions,
  getMonthlyBalances,
  getTransactionsGroupedByMonth,
  type MonthSection,
  type MonthlyBalance,
} from "@/services/financeService";
import { getSetting, setSetting } from "@/services/settingsService";
import { extractCentsFromInput, formatBRL } from "@/utils/currency";
import { useFocusEffect, useRouter } from "expo-router";
import {
  BanknoteArrowDown,
  BanknoteArrowUp,
  CircleHelp,
  Edit3, Trash2,
  Wallet
} from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  SectionList,
  SectionListProps,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Animated from "react-native-reanimated";

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList) as unknown as React.ComponentType<SectionListProps<Transaction, MonthSection>>;

export default function FinancesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { primaryColor, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const safeAccent = getContrastSafeColor(primaryColor, isDark);
  const dialog = useDialog();

  const { scrollY, headerScrollY, scrollHandler } = useHeaderSnap({ snapThreshold: 50 });

  const [balance, setBalance] = useState(0);
  const [sections, setSections] = useState<MonthSection[]>([]);
  const [chartData, setChartData] = useState<MonthlyBalance[]>([]);

  const colors = {
    text: isDark ? "#FAFAFA" : "#18181B",
    textSecondary: isDark ? "#A1A1AA" : "#71717A",
    surface: isDark ? "#0A0A0A" : "#FFFFFF",
    surfaceSecondary: isDark ? "#171717" : "#F5F5F5",
    surfaceTertiary: isDark ? "#262626" : "#E4E4E7",
    border: isDark ? "#262626" : "#E5E5E5",
  };

  const loadData = useCallback(async () => {
    const [balanceStr, allTransactions] = await Promise.all([
      getSetting("finance_balance"),
      getAllTransactions(),
    ]);
    const initialBalance = parseInt(balanceStr || "0", 10);

    // Compute effective balance: initial + incomes - expenses
    let computed = initialBalance;
    for (const t of allTransactions) {
      if (t.isAmountUndefined) continue;
      computed += t.type === "income" ? t.amount : -t.amount;
    }
    setBalance(computed);

    setSections(getTransactionsGroupedByMonth(allTransactions));
    setChartData(getMonthlyBalances(allTransactions));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleDeleteTransaction = (item: Transaction) => {
    dialog.show({
      title: "Remover transação",
      description: `Deseja remover "${item.title}"?`,
      buttons: [
        { text: "Cancelar", variant: "ghost" },
        {
          text: "Remover",
          variant: "destructive",
          onPress: async () => {
            await deleteTransaction(item.id);
            await loadData();
          },
        },
      ],
    });
  };

  const handleUpdateBalance = async (text: string) => {
    const cents = extractCentsFromInput(text);
    await setSetting("finance_balance", cents.toString());
    await loadData(); // Recompute effective balance with transactions
  };

  const renderSectionHeader = ({ section }: { section: MonthSection }) => (
    <View
      style={[styles.sectionHeader, { backgroundColor: colors.surface }]}
    >
      <Text style={[styles.sectionTitle, { color: safeAccent }]}>
        {section.title}
      </Text>
    </View>
  );

  const renderItem = ({ item, index }: { item: Transaction; index: number }) => {
    const isIncome = item.type === "income";
    const iconColor = isIncome ? "#22C55E" : "#EF4444";
    const Icon = isIncome ? BanknoteArrowUp : BanknoteArrowDown;
    const sign = isIncome ? "+" : "-";
    const amountText = item.isAmountUndefined
      ? "A definir"
      : `${sign} ${formatBRL(item.amount)}`;

    return (
      <View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() =>
            router.push({
              pathname: "/finance/editor",
              params: { id: item.id.toString() },
            })
          }
          style={[
            styles.transactionItem,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.transactionIcon,
              { backgroundColor: iconColor + "18" },
            ]}
          >
            <Icon size={18} color={iconColor} />
          </View>

          <View style={styles.transactionInfo}>
            <Text
              style={[styles.transactionTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {item.description ? (
              <Text
                style={[
                  styles.transactionDesc,
                  { color: colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {item.description.replace(/<[^>]*>/g, "").substring(0, 40)}
              </Text>
            ) : null}
          </View>

          <View style={styles.transactionRight}>
            <Text
              style={[
                styles.transactionAmount,
                {
                  color: item.isAmountUndefined
                    ? colors.textSecondary
                    : iconColor,
                },
              ]}
            >
              {amountText}
            </Text>
            <TouchableOpacity
              onPress={() => handleDeleteTransaction(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.deleteBtn}
            >
              <Trash2 size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const ListHeader = () => (
    <>
      {/* Page Header */}
      <View className="px-6 mb-6">
        <Text className="font-sans-bold text-3xl text-on-surface mt-1">
          Finanças
        </Text>
      </View>

      {/* Balance Card */}
      <View
        style={[
          styles.balanceCard,
          {
            overflow: "hidden", // Important to mask the absolute gradient
            borderWidth: 0,
            padding: 24, // Increased padding to match the Slide
            height: 120, // Match the slide fixed height
            justifyContent: "center",
          },
        ]}
      >
        <CardGradient color="#10B981" style={StyleSheet.absoluteFill} hasSolidBackground />
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Wallet size={18} color="rgba(255,255,255,0.8)" />
          <Text style={{ fontFamily: "Montserrat-Medium", fontSize: 13, color: "rgba(255,255,255,0.8)", marginLeft: 8, flex: 1 }}>
            Saldo Atual
          </Text>
          <TouchableOpacity
            onPress={() => {
                dialog.show({
                    title: "Definir saldo",
                    description: "Informe seu saldo total atual:",
                    prompt: {
                        defaultValue: formatBRL(balance),
                        placeholder: "R$ 0,00",
                        onConfirm: handleUpdateBalance
                    },
                    buttons: [
                        { text: "Cancelar", variant: "ghost" },
                        { text: "Confirmar", variant: "default" }
                    ]
                });
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Edit3 size={16} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
        <Text style={{ fontFamily: "Montserrat-Bold", fontSize: 32, color: "#FFFFFF" }}>
          {formatBRL(balance)}
        </Text>
      </View>

      <View
        style={styles.actionsRow}
      >
        <Button
          variant="ghost"
          onPress={() =>
            router.push({
              pathname: "/finance/editor",
              params: { type: "income" },
            })
          }
          className="flex-1 flex-row items-center justify-center gap-4 px-4 py-[14px] rounded-2xl border"
          style={{ 
            backgroundColor: "#22C55E15",
            borderColor: "#22C55E30",
          }}
        >
        <BanknoteArrowUp size={20} color="#22C55E" />
        <Text className="font-sans-bold text-[15px]" style={{ color: "#22C55E" }}>
          Receita
        </Text>
        </Button>

        <Button
          variant="ghost"
          onPress={() =>
            router.push({
              pathname: "/finance/editor",
              params: { type: "expense" },
            })
          }
          className="flex-1 flex-row items-center justify-center gap-4 px-4 py-[14px] rounded-2xl border"
          style={{ 
            backgroundColor: "#EF444415",
            borderColor: "#EF444430",
          }}
        >
        <BanknoteArrowDown size={20} color="#EF4444" />
        <Text className="font-sans-bold text-[15px]" style={{ color: "#EF4444" }}>
          Despesa
        </Text>
        </Button>
      </View>

      {/* Chart */}
      <View>
        <View style={[styles.sectionLabelRow, { marginVertical: 16 }]}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>
            Balanço Mensal
          </Text>
        </View>
        <BalanceChart data={chartData} />
      </View>

      {/* Transactions Section Label */}
      <View style={[styles.sectionLabelRow, { marginVertical: 16 }]}>
        <Text style={[styles.sectionLabel, { color: colors.text }]}>
          Transações
        </Text>
      </View>
    </>
  );

  const ListEmpty = () => (
    <View style={styles.emptyState}>
      <CircleHelp size={40} color={colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        Nenhuma transação
      </Text>
      <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
        Adicione receitas e despesas para acompanhar suas finanças.
      </Text>
    </View>
  );

  return (
    <View className="flex-1 bg-surface">
      {/* Floating Header */}
      <TabHeader
        scrollY={headerScrollY}
        title="Finanças"
        backgroundThreshold={[15, 30]}
        titleThreshold={[30, 50]}
        hasSlideIn
      />

      <AnimatedSectionList
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        sections={sections}
        keyExtractor={(item: Transaction) => item.id.toString()}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={{ 
            paddingTop: insets.top + 16, 
            paddingBottom: 120 
        }}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />


    </View>
  );
}

// ─── Styles ──────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  pageHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    fontFamily: "Montserrat-Bold",
  },
  balanceCard: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  balanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  balanceIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: "800",
    fontFamily: "Montserrat-Bold",
  },
  actionsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 16,
  },
  sectionLabelRow: {
    paddingHorizontal: 20,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Montserrat-Bold",
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
    gap: 2,
  },
  transactionTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  transactionDesc: {
    fontSize: 12,
  },
  transactionRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: "700",
  },
  deleteBtn: {
    padding: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
