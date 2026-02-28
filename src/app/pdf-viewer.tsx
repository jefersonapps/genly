
import { useTheme } from '@/providers/ThemeProvider';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { ChevronLeft, Share2 } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TransparencyGrid } from '@/components/ui/TransparencyGrid';
import Pdf from 'react-native-pdf';

export default function NativePDFViewerScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [loading, setLoading] = React.useState(true);

  const pdfSource = React.useMemo(() => {
    if (!uri) return null;
    return { uri: uri, cache: true };
  }, [uri]);

  const handleShare = async () => {
    if (uri) await Sharing.shareAsync(uri);
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#121212' : '#F4F4F5' }]}>
      <TransparencyGrid size={24} opacity={0.4} />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: isDark ? '#18181b' : '#FFFFFF' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={28} color={isDark ? '#FFF' : '#000'} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? '#FFF' : '#000' }]} numberOfLines={1}>
          Visualizador de PDF
        </Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
          <Share2 size={24} color={primaryColor} />
        </TouchableOpacity>
      </View>

      {/* Native PDF Viewer */}
      <View style={styles.viewerContainer}>
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
            style={[styles.pdf, { backgroundColor: 'transparent' }]}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: isDark ? '#FFF' : '#000' }}>URI de PDF inválida</Text>
          </View>
        )}
        
        {loading && (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' }]}>
             <ActivityIndicator size="large" color={primaryColor} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    zIndex: 10,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  shareButton: {
    padding: 4,
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  pdf: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  }
});
