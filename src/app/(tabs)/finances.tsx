import { getContrastSafeColor } from "@/components/editor/Editor";
import { BalanceChart } from "@/components/finance/BalanceChart";
import { PromptModal } from "@/components/ui/PromptModal";
import type { Transaction } from "@/db/schema";
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
import { extractCentsFromInput, formatBRL, formatBRLInput } from "@/utils/currency";
import { useFocusEffect, useRouter } from "expo-router";
import {
    ArrowDownLeft,
    ArrowUpRight,
    CircleHelp,
    Edit3,
    Plus,
    Trash2,
    TrendingDown,
    TrendingUp,
    Wallet,
} from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
    SectionList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import Animated, {
    Extrapolation,
    FadeInDown,
    FadeInUp,
    interpolate,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList) as any;

export default function FinancesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { primaryColor, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const safeAccent = getContrastSafeColor(primaryColor, isDark);
  const dialog = useDialog();

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerTitleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [20, 80],
      [0, 1],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  const headerBarStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [20, 80],
      [-100, 0],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      scrollY.value,
      [20, 80],
      [0, 1],
      Extrapolation.CLAMP
    );
    return { 
      transform: [{ translateY }],
      opacity 
    };
  });

  const [balance, setBalance] = useState(0);
  const [sections, setSections] = useState<MonthSection[]>([]);
  const [chartData, setChartData] = useState<MonthlyBalance[]>([]);
  const [isBalanceModalVisible, setIsBalanceModalVisible] = useState(false);

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
    setIsBalanceModalVisible(false);
    await loadData(); // Recompute effective balance with transactions
  };

  const renderSectionHeader = ({ section }: { section: MonthSection }) => (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={[styles.sectionHeader, { backgroundColor: colors.surface }]}
    >
      <Text style={[styles.sectionTitle, { color: safeAccent }]}>
        {section.title}
      </Text>
    </Animated.View>
  );

  const renderItem = ({ item, index }: { item: Transaction; index: number }) => {
    const isIncome = item.type === "income";
    const iconColor = isIncome ? "#22C55E" : "#EF4444";
    const Icon = isIncome ? ArrowDownLeft : ArrowUpRight;
    const sign = isIncome ? "+" : "-";
    const amountText = item.isAmountUndefined
      ? "A definir"
      : `${sign} ${formatBRL(item.amount)}`;

    return (
      <Animated.View entering={FadeInUp.duration(300).delay(index * 50)}>
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
      </Animated.View>
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
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={[
          styles.balanceCard,
          {
            backgroundColor: isDark
              ? "rgba(255,255,255,0.05)"
              : "rgba(0,0,0,0.03)",
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.balanceHeader}>
          <View style={[styles.balanceIconWrap, { backgroundColor: safeAccent + "18" }]}>
            <Wallet size={20} color={safeAccent} />
          </View>
          <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>
            Saldo Total
          </Text>
          <TouchableOpacity
            onPress={() => setIsBalanceModalVisible(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Edit3 size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.balanceAmount, { color: colors.text }]}>
          {formatBRL(balance)}
        </Text>
      </Animated.View>

      {/* Quick Actions */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(100)}
        style={styles.actionsRow}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            router.push({
              pathname: "/finance/editor",
              params: { type: "income" },
            })
          }
          style={[styles.actionBtn, { backgroundColor: "#22C55E15", borderColor: "#22C55E30" }]}
        >
          <Plus size={16} color="#22C55E" />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TrendingUp size={20} color="#22C55E" />
            <Text style={[styles.actionLabel, { color: "#22C55E" }]}>
              Receita
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            router.push({
              pathname: "/finance/editor",
              params: { type: "expense" },
            })
          }
          style={[styles.actionBtn, { backgroundColor: "#EF444415", borderColor: "#EF444430" }]}
        >
          <Plus size={16} color="#EF4444" />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TrendingDown size={20} color="#EF4444" />
            <Text style={[styles.actionLabel, { color: "#EF4444" }]}>
              Despesa
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Chart */}
      <Animated.View entering={FadeInDown.duration(400).delay(200)}>
        <View style={styles.sectionLabelRow}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>
            Balanço Mensal
          </Text>
        </View>
        <BalanceChart data={chartData} />
      </Animated.View>

      {/* Transactions Section Label */}
      <View style={[styles.sectionLabelRow, { marginTop: 24 }]}>
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
      <Animated.View 
        style={[
          { 
            position: "absolute", 
            top: 0, 
            left: 0, 
            right: 0, 
            zIndex: 50,
          },
          headerBarStyle
        ]}
      >
        <View
          style={{
            paddingTop: insets.top + 4,
            paddingBottom: 8,
            paddingHorizontal: 24,
            flexDirection: 'row',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            backgroundColor: isDark ? '#121212' : '#FFFFFF',
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 3.84,
            elevation: 5,
          }}
        >
          <Animated.Text 
            className="font-sans-bold text-lg text-on-surface"
            style={headerTitleStyle}
          >
            Finanças
          </Animated.Text>
        </View>
      </Animated.View>

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

      <PromptModal
        visible={isBalanceModalVisible}
        title="Definir saldo"
        message="Informe seu saldo total atual:"
        defaultValue={formatBRL(balance)}
        placeholder="R$ 0,00"
        keyboardType="numeric"
        formatInput={formatBRLInput}
        onCancel={() => setIsBalanceModalVisible(false)}
        onConfirm={handleUpdateBalance}
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
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  sectionLabelRow: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
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
