import '../global.css';
import { useDevelopmentTools } from '@/dev/useDevelopmentTools';
import { InAppUpdateDialog } from "@/components/updates/InAppUpdateDialog";
import { DatabaseProvider } from "@/providers/DatabaseProvider";
import { DialogProvider } from "@/providers/DialogProvider";
import { ThemeProvider, useTheme } from "@/providers/ThemeProvider";
import { getSetting } from "@/services/settingsService";
import { refreshAllWidgets } from "@/services/widgetRefreshService";
import { useAppUpdateStore } from "@/store/useAppUpdateStore";
import { rootNavigationSettings } from "@/navigation/backNavigation";
import { withOpacity } from "@/utils/colors";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useFonts } from "expo-font";
import * as LocalAuthentication from "expo-local-authentication";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { Stack, useRootNavigationState, useRouter, type Href } from "expo-router";
import { ShareIntentProvider, ShareIntentModule, useShareIntentContext } from "expo-share-intent";
import { ShareDelivery, shareDestination, shareRequestId } from "@/navigation/shareIntentNavigation";
import { useDialog } from "@/providers/DialogProvider";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { LockKeyhole } from "lucide-react-native";
import React, { useEffect } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';


// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export const unstable_settings = rootNavigationSettings;

function RootLayoutNav() {
  const { resolvedTheme, primaryColor } = useTheme();
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent, error: shareError } = useShareIntentContext();
  const dialog = useDialog();
  const shareDelivery = React.useRef(new ShareDelivery());
  const [shareRetry, setShareRetry] = React.useState(0);
  const shownShareError = React.useRef<string | null>(null);
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key !== undefined;
  const lastNotificationResponse = Notifications.useLastNotificationResponse();
  
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isAuthenticating, setIsAuthenticating] = React.useState(true);
  const [securityEnabled, setSecurityEnabled] = React.useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = React.useState<boolean | null>(null);

  const [fontsLoaded, fontError] = useFonts({
    "Montserrat-Regular": require("../../assets/fonts/Montserrat-Regular.ttf"),
    "Montserrat-Medium": require("../../assets/fonts/Montserrat-Medium.ttf"),
    "Montserrat-SemiBold": require("../../assets/fonts/Montserrat-SemiBold.ttf"),
    "Montserrat-Bold": require("../../assets/fonts/Montserrat-Bold.ttf"),
  });

  const handledNotification = React.useRef<Notifications.NotificationResponse | null>(null);
  useEffect(() => {
    if (!isNavigationReady || !fontsLoaded || !isAuthenticated || !hasCompletedOnboarding) return;
    if (!lastNotificationResponse || handledNotification.current === lastNotificationResponse) return;
    handledNotification.current = lastNotificationResponse;
    const taskId = lastNotificationResponse.notification.request.content.data?.taskId;
    // An explicit widget/share link takes priority over a retained notification.
    if (!hasShareIntent && !Linking.getLinkingURL() && taskId && lastNotificationResponse.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      router.push({ pathname: "/task/[id]", params: { id: String(taskId) } });
    }
    void Notifications.clearLastNotificationResponseAsync().catch((error) => {
      console.warn('Failed to clear the handled notification', error);
    });
  }, [lastNotificationResponse, isNavigationReady, fontsLoaded, isAuthenticated, hasCompletedOnboarding, hasShareIntent, router]);

  useEffect(() => {
    if (isNavigationReady && fontsLoaded && isAuthenticated && hasCompletedOnboarding) {
      // The router has consumed the URL. Do not replay it on a later JS restart.
      Linking.clearInitialURL();
    }
  }, [navigationState, isNavigationReady, fontsLoaded, isAuthenticated, hasCompletedOnboarding]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    async function initApp() {
      // 1. Check security and onboarding
      const enabled = await getSetting("security_enabled");
      const onboardingSetting = await getSetting("has_completed_onboarding");
      const isEnabled = enabled === "1";
      const onboardingCompleted = onboardingSetting === "1";
      
      setSecurityEnabled(isEnabled);
      setHasCompletedOnboarding(onboardingCompleted);
      
      if (isEnabled) {
        authenticate();
      } else {
        setIsAuthenticated(true);
        setIsAuthenticating(false);
      }

      // 2. Initialize default groups
      const { ensureDefaultGroups } = await import("@/services/taskService");
      try {
        await ensureDefaultGroups();
      } catch (e) {
        console.error("Error creating default groups:", e);
      }

      // Replace links in existing widgets after an app update as well.
      void refreshAllWidgets();

      // 3. Check for In-App Updates directly in the background
      const checkUpdates = useAppUpdateStore.getState().checkForUpdates;
      checkUpdates({ silent: true });
    }
    initApp();
  }, []);

  async function authenticate() {
    setIsAuthenticating(true);
    try {
      const results = await LocalAuthentication.authenticateAsync({
        promptMessage: "Acesse suas notas com biometria",
        fallbackLabel: "Usar senha do dispositivo",
      });
      if (results.success) {
        setIsAuthenticated(true);
      }
    } catch (e) {
      console.error("Auth error", e);
    } finally {
      setIsAuthenticating(false);
    }
  }

  const activeRoute = navigationState?.routes[navigationState.index ?? 0];
  const shareNavigationReady = isNavigationReady && fontsLoaded && isAuthenticated && hasCompletedOnboarding === true && !!activeRoute && !['index', 'setup', 'onboarding'].includes(activeRoute.name);

  useEffect(() => {
    const delivery = shareDelivery.current;
    const received = delivery.pendingId;
    if (delivery.receive(activeRoute?.params && 'shareRequestId' in activeRoute.params ? activeRoute.params.shareRequestId : undefined)) {
      if (hasShareIntent && received === shareRequestId(shareIntent)) {
        resetShareIntent();
        return;
      }
    }
    if (!hasShareIntent) { delivery.empty(); return; }
    const id = shareRequestId(shareIntent);
    if (delivery.hasReceived(id)) { resetShareIntent(); return; }
    if (shareNavigationReady && activeRoute?.params && 'shareRequestId' in activeRoute.params && activeRoute.params.shareRequestId === id) {
      if (delivery.begin(id, true) && delivery.receive(id)) resetShareIntent();
      return;
    }
    if (!delivery.begin(id, shareNavigationReady)) return;
    try {
      router.push(shareDestination(shareIntent) as Href);
    } catch (error) {
      console.error('Unable to open shared content', error);
      dialog.show({ title: 'Não foi possível abrir os arquivos', description: 'Seu compartilhamento foi mantido. Tente abrir novamente.', buttons: [
        { text: 'Cancelar', variant: 'ghost', onPress: () => { delivery.retry(); resetShareIntent(); } },
        { text: 'Tentar novamente', onPress: () => { delivery.retry(); setShareRetry(value => value + 1); } },
      ] });
    }
  }, [activeRoute, shareNavigationReady, hasShareIntent, shareIntent, resetShareIntent, router, dialog, shareRetry]);

  useEffect(() => {
    if (!shareError) { shownShareError.current = null; return; }
    if (shownShareError.current === shareError) return;
    shownShareError.current = shareError;
    dialog.show({ title: 'Não foi possível importar os arquivos', description: 'Verifique se as imagens estão disponíveis na galeria e tente novamente.', buttons: [
      { text: 'Cancelar', variant: 'ghost', onPress: () => resetShareIntent() },
      { text: 'Tentar novamente', onPress: () => { shownShareError.current = null; resetShareIntent(false); ShareIntentModule?.getShareIntent(''); } },
    ] });
  }, [shareError, dialog, resetShareIntent]);

  useEffect(() => {
    if (!isNavigationReady || !fontsLoaded || hasCompletedOnboarding !== false || ['setup', 'onboarding'].includes(activeRoute?.name || '')) return;
    let active = true;
    getSetting('has_completed_onboarding').then(value => {
      if (!active) return;
      if (value === '1') setHasCompletedOnboarding(true);
      else router.replace('/setup');
    });
    return () => { active = false; };
  }, [activeRoute?.name, isNavigationReady, fontsLoaded, hasCompletedOnboarding, router]);

  if (securityEnabled && !isAuthenticated) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
         <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
         <View className="items-center p-8 bg-surface-secondary rounded-[3rem] border border-border mx-6">
            <View className="h-20 w-20 rounded-full items-center justify-center mb-6" style={{ backgroundColor: withOpacity(primaryColor, 0.12) }}>
               <LockKeyhole size={40} color={primaryColor} />
            </View>
            <Text className="font-sans-bold text-2xl text-on-surface mb-2 text-center">App Bloqueado</Text>
            <Text className="font-sans text-on-surface-secondary mb-8 text-center px-4 leading-relaxed">Use sua biometria para acessar o Genly</Text>
            
            <TouchableOpacity 
                activeOpacity={0.8}
                onPress={authenticate}
                className="px-8 py-4 rounded-full"
                style={{ backgroundColor: primaryColor }}
            >
                {isAuthenticating ? (
                    <ActivityIndicator color="#FFF" size="small" />
                ) : (
                    <Text className="text-white font-sans-bold text-lg">Desbloquear</Text>
                )}
            </TouchableOpacity>
         </View>
      </View>
    );
  }

  if (!isNavigationReady || !fontsLoaded || hasCompletedOnboarding === null) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color={primaryColor} />
      </View>
    );
  }

  const isDark = resolvedTheme === "dark";
  const backgroundColor = isDark ? "#0A0A0A" : "#FFFFFF";

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="setup" options={{ headerShown: false, animation: "fade" }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, animation: "fade" }} />
        <Stack.Screen name="calendar" options={{ headerShown: false, animation: "fade_from_bottom" }} />
        <Stack.Screen
          name="task/editor"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="task/latex-editor"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="task/[id]"
          options={{ presentation: "card", animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="group/editor"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
         <Stack.Screen
          name="media-preview"
          options={{ presentation: "fullScreenModal", animation: "fade" }}
        />
        <Stack.Screen
          name="backup/confirm-backup"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="search"
          options={{ presentation: "fullScreenModal", animation: "fade", headerShown: false }}
        />
        <Stack.Screen
            name="tools/qr-tool"
            options={{ presentation: "card", animation: "slide_from_right" }}
        />
        <Stack.Screen
            name="tools/ocr-tool"
            options={{ presentation: "card", animation: "slide_from_right" }}
        />
        <Stack.Screen
            name="tools/pdf-organizer"
            options={{ presentation: "card", animation: "slide_from_right" }}
        />
        <Stack.Screen
            name="tools/pdf-to-image"
            options={{ presentation: "card", animation: "slide_from_right" }}
        />
        <Stack.Screen
            name="tools/document-scanner"
            options={{ presentation: "card", animation: "slide_from_right" }}
        />
        <Stack.Screen
            name="tools/mind-map"
            options={{ presentation: "card", animation: "slide_from_right" }}
        />
        <Stack.Screen
            name="tools/pdf-editor"
            options={{ presentation: "card", animation: "slide_from_right" }}
        />
        <Stack.Screen
            name="tools/color-picker"
            options={{ presentation: "card", animation: "slide_from_right" }}
        />
        <Stack.Screen
            name="tools/background-remover"
            options={{ presentation: "card", animation: "slide_from_right" }}
        />
        <Stack.Screen
            name="finance/editor"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  useDevelopmentTools();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ShareIntentProvider options={{ resetOnBackground: false }}>
        <DatabaseProvider>
          <ThemeProvider>
            <BottomSheetModalProvider>
              <DialogProvider>
                <RootLayoutNav />
                <InAppUpdateDialog />
              </DialogProvider>
            </BottomSheetModalProvider>
          </ThemeProvider>
        </DatabaseProvider>
      </ShareIntentProvider>
    </GestureHandlerRootView>
  );
}
