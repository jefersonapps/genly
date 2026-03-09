import { Button } from "@/components/ui/Button";
import { CardGradient } from "@/components/ui/CardGradient";
import { useTheme } from "@/providers/ThemeProvider";
import { shadows } from "@/theme/shadows";
import { withOpacity } from "@/utils/colors";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  ArrowRightLeft,
  Bell,
  Camera,
  ChevronRight,
  Clock,
  DollarSign,
  FileStack,
  Grid3X3,
  ImageDown,
  Info,
  Library,
  Network,
  Paperclip,
  Pipette,
  QrCode,
  ScanText,
  Share2,
  Sparkles,
  Timer,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react-native";
import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ViewToken
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Slide Data ──────────────────────────────────

const TOOL_ITEMS = [
  { icon: Camera, label: "Scanner", color: "#3B82F6" },
  { icon: ScanText, label: "OCR", color: "#8B5CF6" },
  { icon: FileStack, label: "PDF", color: "#EF4444" },
  { icon: ImageDown, label: "Converter", color: "#F59E0B" },
  { icon: Network, label: "Mapa Mental", color: "#10B981" },
  { icon: Library, label: "Flashcards", color: "#EC4899" },
  { icon: Timer, label: "Pomodoro", color: "#F97316" },
  { icon: QrCode, label: "QR Code", color: "#6366F1" },
  { icon: ArrowRightLeft, label: "Medidas", color: "#14B8A6" },
  { icon: Pipette, label: "Conta-gotas", color: "#3B82F6" },
];

const AI_MODES = [
  { label: "Corrigir", emoji: "✏️" },
  { label: "Formatar", emoji: "📝" },
  { label: "Mapa Mental via IA", emoji: "🧠" },
  { label: "Flashcards via IA", emoji: "🃏" },
];

const WIDGET_IMAGES = [
  { source: require("../../assets/widget-preview/recent-tasks.png"), label: "Notas Recentes" },
  { source: require("../../assets/widget-preview/reminders.png"), label: "Lembretes" },
  { source: require("../../assets/widget-preview/flashcards.png"), label: "Flashcards" },
  { source: require("../../assets/widget-preview/mind-maps.png"), label: "Mapas Mentais" },
  { source: require("../../assets/widget-preview/group.png"), label: "Cadernos" },
];

// ─── Individual Slide Components ─────────────────

function SlideNotes({ isDark, primaryColor, width }: { isDark: boolean; primaryColor: string; width: number }) {
  return (
    <ScrollView 
        style={{ width, paddingHorizontal: 24 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingVertical: 20 }}
        showsVerticalScrollIndicator={false}
    >
      <View className="w-full rounded-3xl overflow-hidden mb-8" style={{ minHeight: 280 }}>
        <CardGradient color={primaryColor} className="absolute inset-0" hasSolidBackground />
        <View className="flex-1 p-5 justify-center">
          {/* Mocked note card 1 */}
          <View
            className="mb-3 rounded-2xl bg-surface p-4 border"
            style={[
              { borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" },
              shadows.sm,
            ]}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text className="font-sans-semibold text-base text-on-surface" numberOfLines={1}>
                  📋 Lista de Compras
                </Text>
                <Text className="mt-1 font-sans text-sm text-on-surface-secondary" numberOfLines={2}>
                  Arroz, Feijão, Macarrão, Leite, Ovos, Pão, Café...
                </Text>
              </View>
            </View>
            <View className="mt-3 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Clock size={12} color="rgb(163,163,163)" />
                <Text className="ml-1 font-sans text-xs text-muted" style={{ color: "rgb(163,163,163)" }}>Hoje</Text>
              </View>
            </View>
          </View>

          {/* Mocked note card 2 */}
          <View
            className="rounded-2xl bg-surface p-4 border"
            style={[
              { borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" },
              shadows.sm,
            ]}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text className="font-sans-semibold text-base text-on-surface" numberOfLines={1}>
                  📐 Caderno de Física
                </Text>
                <View className="mt-3 p-3 rounded-2xl"
                    style={{
                        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.03)',
                        borderColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 1
                    }}
                >
                    <View className="flex-row items-center mb-1.5">
                        <View className="w-1.5 h-1.5 rounded-full mr-2" style={{ backgroundColor: '#3B82F6' }} />
                        <Text className="font-sans-bold text-[#3B82F6] text-[10px] uppercase tracking-wider">Primeiro Cartão</Text>
                    </View>
                    <Text className="font-sans text-on-surface text-sm leading-relaxed" numberOfLines={2}>
                        Qual a fórmula da Segunda Lei de Newton?
                    </Text>
                </View>
              </View>
            </View>
            <View className="mt-3 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Clock size={12} color="rgb(163,163,163)" />
                <Text className="ml-1 font-sans text-xs text-muted" style={{ color: "rgb(163,163,163)" }}>Ontem</Text>
                
                <View className="ml-3 flex-row items-center px-2 py-0.5 rounded-full" style={{ backgroundColor: withOpacity(primaryColor, 0.1) }}>
                  <Bell size={10} color={primaryColor} />
                  <Text className="ml-1 font-sans-semibold text-[10px]" style={{ color: primaryColor }}>
                    Amanhã 08:00
                  </Text>
                </View>

                <View className="ml-3 flex-row items-center">
                    <Paperclip size={12} color="rgb(163,163,163)" />
                    <Text className="ml-1 font-sans text-xs text-muted" style={{ color: "rgb(163,163,163)" }}>
                      2
                    </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
      <Text className="font-sans-bold text-2xl text-on-surface text-center mb-3">
        Notas & Cadernos
      </Text>
      <Text className="font-sans text-base text-on-surface-secondary text-center leading-relaxed px-4">
        Crie notas ricas com checklists, imagens, equações LaTeX e muito mais. Organize tudo em cadernos personalizados.
      </Text>
    </ScrollView>
  );
}

function SlideReminders({ isDark, primaryColor, width }: { isDark: boolean; primaryColor: string; width: number }) {
  return (
    <ScrollView 
        style={{ width, paddingHorizontal: 24 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingVertical: 20 }}
        showsVerticalScrollIndicator={false}
    >
      <View className="w-full mb-8">
        <View className={`rounded-3xl p-5 ${isDark ? "bg-white/5" : "bg-black/[0.03]"}`}
          style={{ borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}
        >
          {/* Mocked reminder */}
          <View className="flex-row items-center mb-5">
            <View className="h-12 w-12 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: withOpacity(primaryColor, 0.12) }}>
              <Bell size={24} color={primaryColor} />
            </View>
            <View className="flex-1">
              <Text className="font-sans-bold text-[15px]" style={{ color: isDark ? "#FAFAFA" : "#18181B" }}>Reunião de Projeto</Text>
              <Text className="font-sans text-xs" style={{ color: isDark ? "#A1A1AA" : "#71717A" }}>Hoje, 14:30</Text>
            </View>
            <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: withOpacity(primaryColor, 0.12) }}>
              <Text className="font-sans-bold text-[11px]" style={{ color: primaryColor }}>Em breve</Text>
            </View>
          </View>

          <View className="h-[1px]" style={{ backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" }} />

          <View className="flex-row items-center mt-5">
            <View className="h-12 w-12 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: withOpacity("#F59E0B", 0.12) }}>
              <Clock size={24} color="#F59E0B" />
            </View>
            <View className="flex-1">
              <Text className="font-sans-bold text-[15px]" style={{ color: isDark ? "#FAFAFA" : "#18181B" }}>Entregar Trabalho</Text>
              <Text className="font-sans text-xs" style={{ color: isDark ? "#A1A1AA" : "#71717A" }}>Amanhã, 08:00</Text>
            </View>
            <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: withOpacity("#F59E0B", 0.12) }}>
              <Text className="font-sans-bold text-[11px]" style={{ color: "#F59E0B" }}>Amanhã</Text>
            </View>
          </View>
        </View>
      </View>
      <Text className="font-sans-bold text-2xl text-on-surface text-center mb-3">
        Lembretes Inteligentes
      </Text>
      <Text className="font-sans text-base text-on-surface-secondary text-center leading-relaxed px-4">
        Configure lembretes em qualquer nota para nunca esquecer prazos, reuniões ou tarefas importantes.
      </Text>
    </ScrollView>
  );
}

function SlideTools({ isDark, primaryColor, width }: { isDark: boolean; primaryColor: string; width: number }) {
  return (
    <ScrollView 
        style={{ width, paddingHorizontal: 24 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingVertical: 20 }}
        showsVerticalScrollIndicator={false}
    >
      <View className="w-full mb-8">
        <View className="flex-row flex-wrap justify-center gap-3">
          {TOOL_ITEMS.map((tool, i) => {
            const Icon = tool.icon;
            return (
              <View
                key={i}
                className="items-center justify-center rounded-2xl p-3 border"
                style={{
                   width: (width - 72) / 3,
                   backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                   borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                }}
              >
                <View className="h-10 w-10 rounded-xl items-center justify-center mb-2" style={{ backgroundColor: withOpacity(tool.color, 0.12) }}>
                  <Icon size={20} color={tool.color} />
                </View>
                <Text className="font-sans-medium text-[11px] text-center" style={{ color: isDark ? "#D4D4D8" : "#52525B" }}>
                  {tool.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
      <Text className="font-sans-bold text-2xl text-on-surface text-center mb-3">
        Ferramentas Poderosas
      </Text>
      <Text className="font-sans text-base text-on-surface-secondary text-center leading-relaxed px-4">
        Scanner de documentos, OCR, editor de PDF, mapas mentais, flashcards, pomodoro e muito mais.
      </Text>
    </ScrollView>
  );
}

function SlideAI({ isDark, primaryColor, width }: { isDark: boolean; primaryColor: string; width: number }) {
  return (
    <ScrollView 
        style={{ width, paddingHorizontal: 24 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingVertical: 20 }}
        showsVerticalScrollIndicator={false}
    >
      <View className="w-full mb-8 items-center">
        <View className="h-20 w-20 rounded-full items-center justify-center mb-6" style={{ backgroundColor: withOpacity(primaryColor, 0.12) }}>
          <Sparkles size={40} color={primaryColor} />
        </View>
        <View className="w-full gap-2.5">
          {AI_MODES.map((mode, i) => (
            <View
              key={i}
              className="flex-row items-center rounded-2xl px-4 py-3.5 border"
              style={{
                backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
              }}
            >
              <Text className="text-xl mr-3">{mode.emoji}</Text>
              <Text className="font-sans-semibold text-sm" style={{ color: isDark ? "#FAFAFA" : "#18181B" }}>{mode.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text className="font-sans-bold text-2xl text-on-surface text-center mb-3">
        Inteligência Artificial
      </Text>
      <Text className="font-sans text-base text-on-surface-secondary text-center leading-relaxed px-4">
        Use IA para corrigir, formatar textos, gerar mapas mentais e flashcards automaticamente.
      </Text>
    </ScrollView>
  );
}

function SlideFinances({ isDark, primaryColor, width }: { isDark: boolean; primaryColor: string; width: number }) {
  return (
    <ScrollView 
        style={{ width, paddingHorizontal: 24 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingVertical: 20 }}
        showsVerticalScrollIndicator={false}
    >
      <View className="w-full mb-8">
        {/* Balance card */}
        <View className="rounded-3xl overflow-hidden mb-4 h-[120px] relative">
          <CardGradient color="#10B981" className="absolute inset-0" hasSolidBackground />
          
          {/* Coins Image Background */}
          <Animated.Image 
              source={require("../../assets/images/coins.png")} 
              className="absolute -right-4 -bottom-8 w-[110] h-[110] opacity-90"
              style={{
                  transform: [{ rotate: '-15deg' }]
              }}
              resizeMode="contain"
          />

          <View className="flex-1 p-5 justify-center">
            <View className="flex-row items-center mb-1">
              <Wallet size={18} color="rgba(255,255,255,0.8)" />
              <Text className="font-sans-medium text-xs ml-2" style={{ color: "rgba(255,255,255,0.8)" }}>Saldo Atual</Text>
            </View>
            <Text className="font-sans-bold text-[28px] text-white">R$ 2.450,00</Text>
          </View>
        </View>

        {/* Mocked transactions */}
        <View
          className="rounded-2xl overflow-hidden border"
          style={{
            backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
          }}
        >
          <View className="flex-row items-center p-4">
            <View className="h-10 w-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: withOpacity("#EF4444", 0.12) }}>
              <TrendingDown size={18} color="#EF4444" />
            </View>
            <View className="flex-1">
              <Text className="font-sans-semibold text-sm" style={{ color: isDark ? "#FAFAFA" : "#18181B" }}>Mercado</Text>
              <Text className="font-sans text-[11px]" style={{ color: isDark ? "#A1A1AA" : "#71717A" }}>Ontem</Text>
            </View>
            <Text className="font-sans-bold text-sm text-[#EF4444]">- R$ 182,50</Text>
          </View>
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
          <View className="flex-row items-center p-4">
            <View className="h-10 w-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: withOpacity("#10B981", 0.12) }}>
              <TrendingUp size={18} color="#10B981" />
            </View>
            <View className="flex-1">
              <Text className="font-sans-semibold text-sm" style={{ color: isDark ? "#FAFAFA" : "#18181B" }}>Freelance</Text>
              <Text className="font-sans text-[11px]" style={{ color: isDark ? "#A1A1AA" : "#71717A" }}>Hoje</Text>
            </View>
            <Text className="font-sans-bold text-sm text-[#10B981]">+ R$ 800,00</Text>
          </View>
        </View>
      </View>
      <Text className="font-sans-bold text-2xl text-on-surface text-center mb-3">
        Gerenciar Finanças
      </Text>
      <Text className="font-sans text-base text-on-surface-secondary text-center leading-relaxed px-4">
        Controle seus gastos e receitas com um gerenciador financeiro integrado e gráficos de evolução.
      </Text>
    </ScrollView>
  );
}

function SlideSharing({ isDark, primaryColor, width }: { isDark: boolean; primaryColor: string; width: number }) {
  const shareItems = [
    { icon: Share2, label: "Receba PDFs, imagens e textos", color: "#3B82F6" },
    { icon: Grid3X3, label: "Atalhos diretos no menu Compartilhar", color: "#8B5CF6" },
    { icon: DollarSign, label: "Envie arquivos para o Organizador de PDF", color: "#10B981" },
  ];

  return (
    <ScrollView 
        style={{ width, paddingHorizontal: 24 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingVertical: 20 }}
        showsVerticalScrollIndicator={false}
    >
      <View className="w-full mb-8 items-center">
        <View className="h-20 w-20 rounded-full items-center justify-center mb-6" style={{ backgroundColor: withOpacity("#3B82F6", 0.12) }}>
          <Share2 size={40} color="#3B82F6" />
        </View>
        <View className="w-full gap-3">
          {shareItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <View
                key={i}
                className="flex-row items-center rounded-2xl px-4 py-4 border"
                style={{
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                  borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                }}
              >
                <View className="h-10 w-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: withOpacity(item.color, 0.12) }}>
                  <Icon size={20} color={item.color} />
                </View>
                <Text className="flex-1 font-sans-medium text-[13px]" style={{ color: isDark ? "#D4D4D8" : "#3F3F46" }}>
                  {item.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
      <Text className="font-sans-bold text-2xl text-on-surface text-center mb-3">
        Compartilhamento Nativo
      </Text>
      <Text className="font-sans text-base text-on-surface-secondary text-center leading-relaxed px-4 mb-8">
        Compartilhe arquivos de qualquer app diretamente para o Genly. PDFs, imagens e textos são recebidos automaticamente.
      </Text>

      {/* First-time tip */}
      <View 
        className="w-full flex-row items-center p-4 rounded-2xl border"
        style={{ 
          backgroundColor: withOpacity(primaryColor, 0.05),
          borderColor: withOpacity(primaryColor, 0.1),
        }}
      >
        <Info size={16} color={primaryColor} style={{ marginRight: 12 }} />
        <Text className="flex-1 font-sans text-[12px] leading-relaxed" style={{ color: isDark ? "#A1A1AA" : "#71717A" }}>
          <Text className="font-sans-bold" style={{ color: primaryColor }}>Dica: </Text>
          No primeiro uso, talvez precise procurar o Genly no menu <Text className="font-sans-bold" style={{ color: isDark ? "#E4E4E7" : "#3F3F46" }}>"Mais"</Text> ao compartilhar. Depois, ele aparecerá sempre no topo!
        </Text>
      </View>
    </ScrollView>
  );
}

function SlideWidgets({ 
  isDark, 
  primaryColor,
  width,
  onTouchStart,
  onTouchEnd
}: { 
  isDark: boolean; 
  primaryColor: string;
  width: number;
  onTouchStart?: () => void;
  onTouchEnd?: () => void;
}) {
  return (
    <ScrollView 
        style={{ width, paddingHorizontal: 24 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingVertical: 20 }}
        showsVerticalScrollIndicator={false}
    >
      <View className="w-full mb-8">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={(width - 48) * 0.65 + 12}
          decelerationRate="fast"
          contentContainerStyle={{ paddingRight: 24 }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          {WIDGET_IMAGES.map((item, i) => (
            <View
              key={i}
              className="rounded-2xl overflow-hidden mr-3 h-[260px] border"
              style={{
                width: (width - 48) * 0.65,
                backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
              }}
            >
              <Image
                source={item.source}
                style={{ flex: 1, margin: 8, borderRadius: 12 }}
                contentFit="contain"
              />
              <Text className="font-sans-semibold text-xs text-center pb-3" style={{ color: isDark ? "#D4D4D8" : "#52525B" }}>
                {item.label}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <Text className="font-sans-bold text-2xl text-on-surface text-center mb-3">
        Widgets na Tela Inicial
      </Text>
      <Text className="font-sans text-base text-on-surface-secondary text-center leading-relaxed px-4">
        Adicione widgets do Genly à sua tela inicial para acesso rápido a notas, lembretes, flashcards e mais.
      </Text>
    </ScrollView>
  );
}

// ─── Main Onboarding Screen ─────────────────────

type SlideItem = { key: string };

const SLIDES: SlideItem[] = [
  { key: "notes" },
  { key: "reminders" },
  { key: "tools" },
  { key: "ai" },
  { key: "finances" },
  { key: "sharing" },
  { key: "widgets" },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [currentIndex, setCurrentIndex] = useState(0);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const flatListRef = useRef<FlatList<SlideItem>>(null);
  const { width } = useWindowDimensions();

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      router.replace("/");
    }
  };

  const handleSkip = () => {
    router.replace("/");
  };

  const renderSlide = ({ item }: { item: SlideItem }) => {
    const slideProps = { isDark, primaryColor, width };
    return (
      <View style={{ width, flex: 1 }}>
        {item.key === "notes" && <SlideNotes {...slideProps} />}
        {item.key === "reminders" && <SlideReminders {...slideProps} />}
        {item.key === "tools" && <SlideTools {...slideProps} />}
        {item.key === "ai" && <SlideAI {...slideProps} />}
        {item.key === "finances" && <SlideFinances {...slideProps} />}
        {item.key === "sharing" && <SlideSharing {...slideProps} />}
        {item.key === "widgets" && (
          <SlideWidgets 
            {...slideProps} 
            onTouchStart={() => setScrollEnabled(false)}
            onTouchEnd={() => setScrollEnabled(true)}
          />
        )}
      </View>
    );
  };

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
      {/* Top bar: Skip */}
      <View className="flex-row justify-end px-5 py-3">
        <TouchableOpacity activeOpacity={0.8} onPress={handleSkip} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text className="font-sans-semibold text-[15px]" style={{ color: isDark ? "#A1A1AA" : "#71717A" }}>
            Pular
          </Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        scrollEnabled={scrollEnabled}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={{ flex: 1 }}
      />

      {/* Bottom: Pagination + Next Button */}
      <View
        className="px-6 pb-2 items-center"
        style={{ paddingBottom: Math.max(insets.bottom + 8, 24) }}
      >
        {/* Dot indicators */}
        <View className="flex-row items-center justify-center mb-8 gap-2">
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === currentIndex ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === currentIndex
                  ? primaryColor
                  : isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)",
              }}
            />
          ))}
        </View>

        {/* Next / Start button */}
        <Button
          onPress={handleNext}
          className="w-full"
          rounded="full"
          size="lg"
        >
          <Button.Text>{isLastSlide ? "Começar" : "Próximo"}</Button.Text>
          {!isLastSlide && <Button.Icon icon={ChevronRight} />}
        </Button>
      </View>
    </View>
  );
}
