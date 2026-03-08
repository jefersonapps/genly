
import { useTheme } from '@/providers/ThemeProvider';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { ChevronLeft, Share2 } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Pdf from '@/components/ui/PdfWrapper';
import { TransparencyGrid } from '@/components/ui/TransparencyGrid';

export default function NativePDFViewerScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [loading, setLoading] = React.useState(true);
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();

  const pdfSource = React.useMemo(() => {
    if (!uri) return null;
    return { uri: uri, cache: true };
  }, [uri]);

  const handleShare = async () => {
    if (uri) await Sharing.shareAsync(uri);
  };

  return (
    <View className="flex-1" style={[{ backgroundColor: isDark ? '#121212' : '#F4F4F5' }]}>
      <TransparencyGrid size={24} opacity={0.4} />
      {/* Header */}
      <View 
        className="flex-row items-center justify-between px-4 pb-3 border-b z-10" 
        style={[{ paddingTop: insets.top, backgroundColor: isDark ? '#18181b' : '#FFFFFF', borderBottomColor: 'rgba(0,0,0,0.05)' }]}
      >
        <TouchableOpacity activeOpacity={0.8}  onPress={() => router.back()} className="p-1">
          <ChevronLeft size={28} color={isDark ? '#FFF' : '#000'} />
        </TouchableOpacity>
        <Text className="text-lg font-semibold flex-1 text-center mx-2.5" style={[{ color: isDark ? '#FFF' : '#000' }]} numberOfLines={1}>
          Visualizador de PDF
        </Text>
        <TouchableOpacity activeOpacity={0.8}  onPress={handleShare} className="p-1">
          <Share2 size={24} color={primaryColor} />
        </TouchableOpacity>
      </View>

      {/* Native PDF Viewer */}
      <View className="flex-1 bg-transparent">
        {pdfSource ? (
          <Pdf
            source={pdfSource}
            onLoadComplete={(numberOfPages) => {
              console.log(`PDF Loaded! Pages: ${numberOfPages}`);
              setLoading(false);
            }}
            onPageChanged={(page) => {
              console.log(`Current page: ${page}`);
            }}
            onError={(error) => {
              console.log('PDF Error:', error);
              setLoading(false);
            }}
            onPressLink={(uri) => {
              console.log(`Link pressed: ${uri}`);
            }}
            style={[{ backgroundColor: 'transparent', width: SCREEN_W, height: SCREEN_H, flex: 1 }]}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: isDark ? '#FFF' : '#000' }}>URI de PDF inválida</Text>
          </View>
        )}
        
        {loading && (
          <View className="absolute inset-0 items-center justify-center bg-black/20">
             <ActivityIndicator size="large" color={primaryColor} />
          </View>
        )}
      </View>
    </View>
  );
}
