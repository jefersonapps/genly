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
import { extractCentsFromInput, formatBRL, formatBRLInput } from "@/utils/currency";
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
      className="px-5 pt-4 pb-1.5"
      style={{ backgroundColor: colors.surface }}
    >
      <Text className="text-sm font-sans-bold uppercase tracking-widest" style={{ color: safeAccent }}>
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
          activeOpacity={0.8} 
          onPress={() =>
            router.push({
              pathname: "/finance/editor",
              params: { id: item.id.toString() },
            })
          }
          className="flex-row items-center mx-5 mb-2 p-3.5 rounded-2xl border"
          style={[
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            className="w-10 h-10 rounded-xl items-center justify-center mr-3"
            style={{ backgroundColor: iconColor + "18" }}
          >
            <Icon size={18} color={iconColor} />
          </View>

          <View className="flex-1 gap-0.5">
            <Text
              className="text-[15px] font-sans-semibold"
              style={{ color: colors.text }}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {item.description ? (
              <Text
                className="text-xs font-sans"
                style={{ color: colors.textSecondary }}
                numberOfLines={1}
              >
                {item.description.replace(/<[^>]*>/g, "").substring(0, 40)}
              </Text>
            ) : null}
          </View>

          <View className="items-end gap-1">
            <Text
              className="text-sm font-sans-bold"
              style={[
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
              activeOpacity={0.8} 
              onPress={() => handleDeleteTransaction(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="p-1"
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
        className="mx-5 mt-3 p-3 pl-[18px] justify-center relative rounded-[20] overflow-hidden"
      >
        <CardGradient color="#10B981" hasSolidBackground className="absolute inset-0" />
        
        {/* Coins Image Background */}
        <Animated.Image 
            source={require("../../../assets/images/coins.png")} 
            className="absolute -right-5 -bottom-10 w-[140] h-[140] opacity-90"
            style={{
                transform: [{ rotate: '-15deg' }]
            }}
            resizeMode="contain"
        />

        <View className="flex-row items-center mb-2">
          <Wallet size={18} color="rgba(255,255,255,0.8)" />
          <Text className="font-sans-medium text-[13px] text-white/80 ml-2 flex-1">
            Saldo Atual
          </Text>
          <Button
            variant="icon"
            className="px-0"
            onPress={() => {
                dialog.show({
                    title: "Definir saldo",
                    description: "Informe seu saldo total atual:",
                    prompt: {
                        defaultValue: formatBRL(balance),
                        placeholder: "R$ 0,00",
                        formatInput: (text) => formatBRLInput(text),
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
          </Button>
        </View>
        <Text 
          className="font-sans-bold text-[32px] text-white"
          style={{ 
            textShadowColor: 'rgba(0, 0, 0, 0.25)',
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 4
          }}
        >
          {formatBRL(balance)}
        </Text>
      </View>

      <View
        className="flex-row px-5 gap-3 mt-4"
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
        <View className="px-5 my-4">
          <Text 
            className="text-[17px] font-sans-bold"
            style={{ color: colors.text }}
          >
            Balanço Mensal
          </Text>
        </View>
        <BalanceChart data={chartData} />
      </View>

      {/* Transactions Section Label */}
      <View className="px-5 my-4">
        <Text 
          className="text-[17px] font-sans-bold"
          style={{ color: colors.text }}
        >
          Transações
        </Text>
      </View>
    </>
  );

  const ListEmpty = () => (
    <View className="items-center py-10 gap-2">
      <CircleHelp size={40} color={colors.textSecondary} />
      <Text className="text-base font-sans-bold" style={{ color: colors.text }}>
        Nenhuma transação
      </Text>
      <Text className="text-[13px] font-sans text-center px-10" style={{ color: colors.textSecondary }}>
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
