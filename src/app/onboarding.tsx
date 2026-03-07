import { CardGradient } from "@/components/ui/CardGradient";
import { useTheme } from "@/providers/ThemeProvider";
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
  Library,
  Network,
  Paperclip,
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
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ViewToken,
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
];

const AI_MODES = [
  { label: "Resumir", emoji: "📝" },
  { label: "Corrigir", emoji: "✏️" },
  { label: "Expandir", emoji: "📖" },
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
        <CardGradient color={primaryColor} style={StyleSheet.absoluteFill} hasSolidBackground />
        <View className="flex-1 p-5 justify-center">
          {/* Mocked note card 1 */}
          <View
            className="mb-3 rounded-2xl bg-surface p-4"
            style={{
              borderWidth: 1,
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 3,
              elevation: 3,
            }}
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
            className="rounded-2xl bg-surface p-4"
            style={{
              borderWidth: 1,
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 3,
              elevation: 3,
            }}
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
              <Text style={{ fontFamily: "Montserrat-Bold", fontSize: 15, color: isDark ? "#FAFAFA" : "#18181B" }}>Reunião de Projeto</Text>
              <Text style={{ fontFamily: "Montserrat-Regular", fontSize: 12, color: isDark ? "#A1A1AA" : "#71717A" }}>Hoje, 14:30</Text>
            </View>
            <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: withOpacity(primaryColor, 0.12) }}>
              <Text style={{ fontFamily: "Montserrat-Bold", fontSize: 11, color: primaryColor }}>Em breve</Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" }} />

          <View className="flex-row items-center mt-5">
            <View className="h-12 w-12 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: withOpacity("#F59E0B", 0.12) }}>
              <Clock size={24} color="#F59E0B" />
            </View>
            <View className="flex-1">
              <Text style={{ fontFamily: "Montserrat-Bold", fontSize: 15, color: isDark ? "#FAFAFA" : "#18181B" }}>Entregar Trabalho</Text>
              <Text style={{ fontFamily: "Montserrat-Regular", fontSize: 12, color: isDark ? "#A1A1AA" : "#71717A" }}>Amanhã, 08:00</Text>
            </View>
            <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: withOpacity("#F59E0B", 0.12) }}>
              <Text style={{ fontFamily: "Montserrat-Bold", fontSize: 11, color: "#F59E0B" }}>Amanhã</Text>
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
                className="items-center justify-center rounded-2xl p-3"
                style={{
                  width: (width - 72) / 3,
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                }}
              >
                <View className="h-10 w-10 rounded-xl items-center justify-center mb-2" style={{ backgroundColor: withOpacity(tool.color, 0.12) }}>
                  <Icon size={20} color={tool.color} />
                </View>
                <Text style={{ fontFamily: "Montserrat-Medium", fontSize: 11, color: isDark ? "#D4D4D8" : "#52525B", textAlign: "center" }}>
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
              className="flex-row items-center rounded-2xl px-4 py-3.5"
              style={{
                backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                borderWidth: 1,
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
              }}
            >
              <Text style={{ fontSize: 20, marginRight: 12 }}>{mode.emoji}</Text>
              <Text style={{ fontFamily: "Montserrat-SemiBold", fontSize: 14, color: isDark ? "#FAFAFA" : "#18181B" }}>{mode.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text className="font-sans-bold text-2xl text-on-surface text-center mb-3">
        Inteligência Artificial
      </Text>
      <Text className="font-sans text-base text-on-surface-secondary text-center leading-relaxed px-4">
        Use IA para resumir, corrigir, expandir textos ou gerar mapas mentais e flashcards automaticamente.
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
        <View className="rounded-3xl overflow-hidden mb-4" style={{ height: 120 }}>
          <CardGradient color="#10B981" style={StyleSheet.absoluteFill} hasSolidBackground />
          <View className="flex-1 p-5 justify-center">
            <View className="flex-row items-center mb-1">
              <Wallet size={18} color="rgba(255,255,255,0.8)" />
              <Text style={{ fontFamily: "Montserrat-Medium", fontSize: 12, color: "rgba(255,255,255,0.8)", marginLeft: 8 }}>Saldo Atual</Text>
            </View>
            <Text style={{ fontFamily: "Montserrat-Bold", fontSize: 28, color: "#FFFFFF" }}>R$ 2.450,00</Text>
          </View>
        </View>

        {/* Mocked transactions */}
        <View
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
            borderWidth: 1,
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
          }}
        >
          <View className="flex-row items-center p-4">
            <View className="h-10 w-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: withOpacity("#EF4444", 0.12) }}>
              <TrendingDown size={18} color="#EF4444" />
            </View>
            <View className="flex-1">
              <Text style={{ fontFamily: "Montserrat-SemiBold", fontSize: 14, color: isDark ? "#FAFAFA" : "#18181B" }}>Mercado</Text>
              <Text style={{ fontFamily: "Montserrat-Regular", fontSize: 11, color: isDark ? "#A1A1AA" : "#71717A" }}>Ontem</Text>
            </View>
            <Text style={{ fontFamily: "Montserrat-Bold", fontSize: 14, color: "#EF4444" }}>- R$ 182,50</Text>
          </View>
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
          <View className="flex-row items-center p-4">
            <View className="h-10 w-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: withOpacity("#10B981", 0.12) }}>
              <TrendingUp size={18} color="#10B981" />
            </View>
            <View className="flex-1">
              <Text style={{ fontFamily: "Montserrat-SemiBold", fontSize: 14, color: isDark ? "#FAFAFA" : "#18181B" }}>Freelance</Text>
              <Text style={{ fontFamily: "Montserrat-Regular", fontSize: 11, color: isDark ? "#A1A1AA" : "#71717A" }}>Hoje</Text>
            </View>
            <Text style={{ fontFamily: "Montserrat-Bold", fontSize: 14, color: "#10B981" }}>+ R$ 800,00</Text>
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
                className="flex-row items-center rounded-2xl px-4 py-4"
                style={{
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                }}
              >
                <View className="h-10 w-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: withOpacity(item.color, 0.12) }}>
                  <Icon size={20} color={item.color} />
                </View>
                <Text className="flex-1" style={{ fontFamily: "Montserrat-Medium", fontSize: 13, color: isDark ? "#D4D4D8" : "#3F3F46" }}>
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
      <Text className="font-sans text-base text-on-surface-secondary text-center leading-relaxed px-4">
        Compartilhe arquivos de qualquer app diretamente para o Genly. PDFs, imagens e textos são recebidos automaticamente.
      </Text>
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
              className="rounded-2xl overflow-hidden mr-3"
              style={{
                width: (width - 48) * 0.65,
                height: 260,
                backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                borderWidth: 1,
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
              }}
            >
              <Image
                source={item.source}
                style={{ flex: 1, margin: 8, borderRadius: 12 }}
                contentFit="contain"
              />
              <Text
                style={{
                  fontFamily: "Montserrat-SemiBold",
                  fontSize: 12,
                  color: isDark ? "#D4D4D8" : "#52525B",
                  textAlign: "center",
                  paddingBottom: 12,
                }}
              >
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
        <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ fontFamily: "Montserrat-SemiBold", fontSize: 15, color: isDark ? "#A1A1AA" : "#71717A" }}>
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
        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={0.8}
          className="w-full rounded-full py-4 flex-row items-center justify-center"
          style={{ backgroundColor: primaryColor }}
        >
          <Text style={{ fontFamily: "Montserrat-Bold", fontSize: 16, color: "#FFFFFF" }}>
            {isLastSlide ? "Começar" : "Próximo"}
          </Text>
          {!isLastSlide && <ChevronRight size={20} color="#FFFFFF" style={{ marginLeft: 4 }} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}
