import { Button } from '@/components/ui/Button';
import { useTheme } from '@/providers/ThemeProvider';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Camera, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props { onClose: () => void; onScanned: (data: string) => void }
const SCANNER_SETTINGS = { barcodeTypes: ['qr'] as ['qr'] };

export function QrScannerModal({ onClose, onScanned }: Props) {
  const [permission, requestPermission, refreshPermission] = useCameraPermissions();
  const { resolvedTheme, primaryColor } = useTheme();
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const consumed = useRef(false);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      setForeground(state === 'active');
      if (state === 'active') void refreshPermission().catch(() => {});
    });
    return () => listener.remove();
  }, [refreshPermission]);
  const handleCode = (data: string) => {
    if (consumed.current || !data.trim()) return;
    consumed.current = true;
    onScanned(data);
  };

  return (
    <Modal visible transparent={false} animationType="none" hardwareAccelerated statusBarTranslucent navigationBarTranslucent
      onShow={() => setShown(true)} onRequestClose={onClose}>
      <View style={styles.container} onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setViewport(current => current.width === width && current.height === height ? current : { width, height });
      }}>
        {!permission ? <View style={styles.center}><ActivityIndicator color={primaryColor} size="large" /></View> : !permission.granted ? (
          <View className="flex-1 items-center justify-center p-6" style={{ backgroundColor: resolvedTheme === 'dark' ? '#0a0a0a' : '#fff' }}>
            <Camera size={48} color={primaryColor} />
            <Text className="text-center font-sans-bold text-xl text-on-surface mt-6 mb-2">Permissão da câmera</Text>
            <Text className="text-center font-sans text-on-surface-secondary mb-8">Precisamos da sua permissão para usar a câmera e ler códigos QR.</Text>
            <Button onPress={() => {
              if (permission.canAskAgain) void requestPermission();
              else void Linking.openSettings();
            }} className="w-full">
              <Button.Text>{permission.canAskAgain ? 'Conceder permissão' : 'Abrir configurações'}</Button.Text>
            </Button>
          </View>
        ) : shown && foreground && viewport.width > 0 && viewport.height > 0 ? (
          <CameraSession onScanned={handleCode} color={primaryColor} guideSize={Math.min(256, viewport.width * 0.7, viewport.height * 0.5)} />
        ) : <View style={styles.center}><ActivityIndicator color="#fff" size="large" /></View>}
        <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar câmera" activeOpacity={0.8}
          style={[styles.close, { top: insets.top + 12 }]}>
          <X size={26} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function CameraSession({ onScanned, color, guideSize }: { onScanned: (data: string) => void; color: string; guideSize: number }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (failed) return (
    <View style={[styles.center, { padding: 32 }]}>
      <Camera size={42} color={color} />
      <Text style={styles.message}>Não foi possível abrir a câmera. Verifique se outro aplicativo está usando a câmera e tente novamente.</Text>
      <Button onPress={() => { setReady(false); setFailed(false); setAttempt(value => value + 1); }}>
        <Button.Text>Tentar novamente</Button.Text>
      </Button>
    </View>
  );
  return (
    <View style={styles.container}>
      <CameraView
        key={attempt}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode="picture"
        barcodeScannerSettings={SCANNER_SETTINGS}
        onCameraReady={() => setReady(true)}
        onMountError={event => { console.debug('QR camera preview failed:', event.message); setFailed(true); }}
        onBarcodeScanned={event => { if (ready) onScanned(event.data); }}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
        <View style={{ width: guideSize, height: guideSize, borderWidth: 2, borderColor: '#fff', borderRadius: 32 }} />
        <Text style={styles.message}>{ready ? 'Posicione o código QR no centro' : 'Abrindo câmera…'}</Text>
        {!ready && <ActivityIndicator color="#fff" size="large" />}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', right: 16, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  message: { fontFamily: 'Montserrat-SemiBold', color: '#fff', fontSize: 16, textAlign: 'center', marginTop: 24, marginBottom: 20, paddingHorizontal: 24 },
});
