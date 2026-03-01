import { SettingsRow } from "@/components/settings/SettingsRow";
import { TabHeader } from "@/components/ui/TabHeader";
import { useTheme } from "@/providers/ThemeProvider";
import { useRouter } from "expo-router";
import { ArrowRightLeft, Camera, FilePen, FileStack, ImageDown, Library, Network, QrCode, ScanText, Sigma, Timer } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";
import Animated, {
    useAnimatedScrollHandler, useSharedValue
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ToolsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === "dark";

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const iconColor = primaryColor === "#000000" || primaryColor === "#000" 
    ? (isDark ? "#FFF" : "#000") 
    : primaryColor;

  return (
    <View className="flex-1 bg-surface">
      {/* Floating Header */}
      <TabHeader
        scrollY={scrollY}
        title="Ferramentas"
        titleThreshold={[15, 30]}
        hasSlideIn
      />

      <Animated.ScrollView 
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 100, // accommodate bottom bar
        }}
      >
         {/* Static Title */}
         <View className="px-6 mb-6">
            <Text className="font-sans-bold text-3xl text-on-surface mt-1">Ferramentas</Text>
         </View>

         {/* Seção 1: Documentos & PDF */}
         <View className="px-5 pb-2 mt-2">
            <Text className="font-sans-bold text-lg text-on-surface mb-2">Documentos & PDF</Text>
         </View>
        <View className="mx-5 overflow-hidden rounded-2xl bg-surface-secondary">
          <SettingsRow
            icon={<Camera size={20} color={iconColor} />}
            title="Scanner de Documentos"
            subtitle="Escaneie documentos e transforme em notas"
            showChevron
            onPress={() => router.push("/tools/document-scanner")}
          />
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
          <SettingsRow
            icon={<ScanText size={20} color={iconColor} />}
            title="Extrair Texto (OCR)"
            subtitle="Reconheça e copie textos usando a câmera"
            showChevron
            onPress={() => router.push("/tools/ocr-tool")}
          />
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
          <SettingsRow
            icon={<FileStack size={20} color={iconColor} />}
            title="Organizador de PDF"
            subtitle="Junte, reordene e exporte arquivos PDF"
            showChevron
            onPress={() => router.push("/tools/pdf-organizer")}
          />
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
           <SettingsRow
            icon={<ImageDown size={20} color={iconColor} />}
            title="PDF para Imagem"
            subtitle="Converta páginas de PDF em imagens"
            showChevron
            onPress={() => router.push("/tools/pdf-to-image")}
          />
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
          <SettingsRow
            icon={<FilePen size={20} color={iconColor} />}
            title="Editor de PDF"
            subtitle="Adicione textos, imagens e apague trechos"
            showChevron
            onPress={() => router.push("/tools/pdf-editor")}
          />
        </View>

        {/* Seção 2: Estudos & Criação */}
        <View className="px-5 pb-2 mt-6">
            <Text className="font-sans-bold text-lg text-on-surface mb-2">Estudos & Criação</Text>
        </View>
        <View className="mx-5 overflow-hidden rounded-2xl bg-surface-secondary">
          <SettingsRow
            icon={<Network size={20} color={iconColor} />}
            title="Mapa Mental"
            subtitle="Crie mapas mentais interativos"
            showChevron
            onPress={() => router.push("/tools/mind-map")}
          />
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
           <SettingsRow
            icon={<Sigma size={20} color={iconColor} />}
            title="Nova Equação"
            subtitle="Crie uma nova nota com uma equação LaTeX"
            showChevron
            onPress={() => router.push("/task/latex-editor?mode=createTask")}
          />
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
          <SettingsRow
            icon={<Timer size={20} color={iconColor} />}
            title="Timer Pomodoro"
            subtitle="Cronômetro para manter o foco nos estudos"
            showChevron
            onPress={() => router.push("/tools/pomodoro")}
          />
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
          <SettingsRow
            icon={<Library size={20} color={iconColor} />}
            title="Gerador de Flashcards"
            subtitle="Crie cartões de estudo para revisão"
            showChevron
            onPress={() => router.push("/tools/flashcards")}
          />
        </View>

        {/* Seção 3: Utilitários */}
        <View className="px-5 pb-2 mt-6">
            <Text className="font-sans-bold text-lg text-on-surface mb-2">Utilitários</Text>
        </View>
        <View className="mx-5 mb-8 overflow-hidden rounded-2xl bg-surface-secondary">
          <SettingsRow
            icon={<ArrowRightLeft size={20} color={iconColor} />}
            title="Conversor de Medidas"
            subtitle="Converta moedas, pesos, tempo e mais"
            showChevron
            onPress={() => router.push("/tools/unit-converter")}
          />
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
          <SettingsRow
            icon={<QrCode size={20} color={iconColor} />}
            title="Código QR"
            subtitle="Crie ou leia códigos QR de forma inteligente"
            showChevron
            onPress={() => router.push("/tools/qr-tool")}
          />
        </View>

      </Animated.ScrollView>
    </View>
  );
}
