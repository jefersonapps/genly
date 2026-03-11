import { SettingsRow } from "@/components/settings/SettingsRow";
import { TabHeader } from "@/components/ui/TabHeader";
import { useHeaderSnap } from "@/hooks/useHeaderSnap";
import { useTheme } from "@/providers/ThemeProvider";
import { withOpacity } from "@/utils/colors";
import { useRouter } from "expo-router";
import { ArrowRightLeft, Camera, FilePen, FileStack, ImageDown, Library, Network, Pipette, QrCode, ScanText, Sigma, Timer, Wand2 } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ToolsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const { headerScrollY, scrollHandler } = useHeaderSnap({ snapThreshold: 30 });

  return (
    <View className="flex-1 bg-surface">
      {/* Floating Header */}
      <TabHeader
        scrollY={headerScrollY}
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
            icon={<Camera size={20} color="#3B82F6" />}
            iconBackgroundColor={withOpacity("#3B82F6", isDark ? 0.15 : 0.12)}
            title="Scanner de Documentos"
            subtitle="Escaneie documentos e transforme em notas"
            showChevron
            onPress={() => router.push("/tools/document-scanner")}
          />
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
          <SettingsRow
            icon={<ScanText size={20} color="#8B5CF6" />}
            iconBackgroundColor={withOpacity("#8B5CF6", isDark ? 0.15 : 0.12)}
            title="Extrair Texto (OCR)"
            subtitle="Reconheça e copie textos usando a câmera"
            showChevron
            onPress={() => router.push("/tools/ocr-tool")}
          />
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
          <SettingsRow
            icon={<FileStack size={20} color="#EF4444" />}
            iconBackgroundColor={withOpacity("#EF4444", isDark ? 0.15 : 0.12)}
            title="Organizador de PDF"
            subtitle="Junte, reordene e exporte arquivos PDF"
            showChevron
            onPress={() => router.push("/tools/pdf-organizer")}
          />
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
           <SettingsRow
            icon={<ImageDown size={20} color="#F59E0B" />}
            iconBackgroundColor={withOpacity("#F59E0B", isDark ? 0.15 : 0.12)}
            title="PDF para Imagem"
            subtitle="Converta páginas de PDF em imagens"
            showChevron
            onPress={() => router.push("/tools/pdf-to-image")}
          />
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
          <SettingsRow
            icon={<FilePen size={20} color="#EAB308" />}
            iconBackgroundColor={withOpacity("#EAB308", isDark ? 0.15 : 0.12)}
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
            icon={<Network size={20} color="#10B981" />}
            iconBackgroundColor={withOpacity("#10B981", isDark ? 0.15 : 0.12)}
            title="Mapa Mental"
            subtitle="Crie mapas mentais interativos"
            showChevron
            onPress={() => router.push("/tools/mind-map")}
          />
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
           <SettingsRow
            icon={<Sigma size={20} color="#0EA5E9" />}
            iconBackgroundColor={withOpacity("#0EA5E9", isDark ? 0.15 : 0.12)}
            title="Nova Equação"
            subtitle="Crie uma nova nota com uma equação LaTeX"
            showChevron
            onPress={() => router.push("/task/latex-editor?mode=createTask")}
          />
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
          <SettingsRow
            icon={<Timer size={20} color="#F97316" />}
            iconBackgroundColor={withOpacity("#F97316", isDark ? 0.15 : 0.12)}
            title="Timer Pomodoro"
            subtitle="Cronômetro para manter o foco nos estudos"
            showChevron
            onPress={() => router.push("/tools/pomodoro")}
          />
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
          <SettingsRow
            icon={<Library size={20} color="#EC4899" />}
            iconBackgroundColor={withOpacity("#EC4899", isDark ? 0.15 : 0.12)}
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
            icon={<ArrowRightLeft size={20} color="#14B8A6" />}
            iconBackgroundColor={withOpacity("#14B8A6", isDark ? 0.15 : 0.12)}
            title="Conversor de Medidas"
            subtitle="Converta moedas, pesos, tempo e mais"
            showChevron
            onPress={() => router.push("/tools/unit-converter")}
          />
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
          <SettingsRow
            icon={<QrCode size={20} color="#6366F1" />}
            iconBackgroundColor={withOpacity("#6366F1", isDark ? 0.15 : 0.12)}
            title="Código QR"
            subtitle="Crie ou leia códigos QR de forma inteligente"
            showChevron
            onPress={() => router.push("/tools/qr-tool")}
          />
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
          <SettingsRow
            icon={<Pipette size={20} color="#E11D48" />}
            iconBackgroundColor={withOpacity("#E11D48", isDark ? 0.15 : 0.12)}
            title="Color Picker"
            subtitle="Extraia cores de imagens com conta-gotas"
            showChevron
            onPress={() => router.push("/tools/color-picker")}
          />
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", marginHorizontal: 16 }} />
          <SettingsRow
            icon={<Wand2 size={20} color="#A855F7" />}
            iconBackgroundColor={withOpacity("#A855F7", isDark ? 0.15 : 0.12)}
            title="Remover Fundo"
            subtitle="Isole objetos de fundo de forma inteligente e offline"
            showChevron
            onPress={() => router.push("/tools/background-remover")}
          />
        </View>

      </Animated.ScrollView>
    </View>
  );
}
