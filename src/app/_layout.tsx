import { DatabaseProvider } from "@/providers/DatabaseProvider";
import { DialogProvider } from "@/providers/DialogProvider";
import { ThemeProvider, useTheme } from "@/providers/ThemeProvider";
import { getSetting } from "@/services/settingsService";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useFonts } from "expo-font";
import * as LocalAuthentication from "expo-local-authentication";
import * as Notifications from "expo-notifications";
import { Stack, useRootNavigationState, useRouter } from "expo-router";
import { useShareIntent } from "expo-share-intent";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { resolvedTheme, primaryColor } = useTheme();
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key !== undefined;
  const lastNotificationResponse = Notifications.useLastNotificationResponse();
  
  useEffect(() => {
    if (!router) return;
    if (
      lastNotificationResponse &&
      lastNotificationResponse.notification.request.content.data.taskId &&
      lastNotificationResponse.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
    ) {
      const taskId = lastNotificationResponse.notification.request.content.data.taskId;
      router.push({ pathname: "/task/[id]", params: { id: String(taskId) } });
    }
  }, [lastNotificationResponse]);
  
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isAuthenticating, setIsAuthenticating] = React.useState(true);
  const [securityEnabled, setSecurityEnabled] = React.useState(false);

  const [fontsLoaded, fontError] = useFonts({
    "Montserrat-Regular": require("../../assets/fonts/Montserrat-Regular.ttf"),
    "Montserrat-Medium": require("../../assets/fonts/Montserrat-Medium.ttf"),
    "Montserrat-SemiBold": require("../../assets/fonts/Montserrat-SemiBold.ttf"),
    "Montserrat-Bold": require("../../assets/fonts/Montserrat-Bold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    async function initApp() {
      // 1. Check security
      const enabled = await getSetting("security_enabled");
      const isEnabled = enabled === "1";
      setSecurityEnabled(isEnabled);
      
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

  useEffect(() => {
    if (!router || !isNavigationReady) return;
    if (isAuthenticated && hasShareIntent && shareIntent) {
      const handleShare = async () => {
        // We use a small timeout to ensure the navigation context is fully mounted
        // and ready, especially during cold starts via Share Intent.
        setTimeout(async () => {
            const firstFile = shareIntent.files?.[0];
            const isBackupFile =
              firstFile &&
              (firstFile.mimeType === "application/json" ||
                firstFile.mimeType === "application/zip" ||
                firstFile.path?.toLowerCase().endsWith(".json") ||
                firstFile.path?.toLowerCase().endsWith(".zip"));

            if (isBackupFile && firstFile) {
              const component = (shareIntent.meta as any)?.component;
              // If it's explicitly the backup activity OR a backup file extension, route to backup
              if (component?.endsWith(".ImportBackupActivity") || isBackupFile) {
                router.push({
                  pathname: "/backup/confirm-backup",
                  params: { fileUri: firstFile.path },
                });
                resetShareIntent();
                return;
              }
            }

            if (shareIntent.type === "text" || shareIntent.type === "weburl") {
                router.push({
                    pathname: "/task/editor",
                    params: {
                        sharedText: (shareIntent as any).value,
                    }
                });
            } else if (shareIntent.type === "media" || (shareIntent.files && shareIntent.files.length > 0)) {
                const uris = shareIntent.files?.map(f => f.path) ?? [];
                if (uris.length > 0) {
                    const component = (shareIntent.meta as any)?.component;
                    
                    if (component?.endsWith(".CreatePdfActivity")) {
                        router.push({
                            pathname: "/tools/pdf-organizer",
                            params: { imageUris: JSON.stringify(uris) }
                        });
                    } else if (component?.endsWith(".ConvertPdfActivity")) {
                        router.push({
                            pathname: "/tools/pdf-to-image",
                            params: { fileUri: uris[0] }
                        });
                    } else if (component?.endsWith(".ScannerActivity")) {
                        router.push({
                            pathname: "/tools/document-scanner",
                            params: { imageUris: JSON.stringify(uris) }
                        });
                    } else if (component?.endsWith(".OcrActivity")) {
                        router.push({
                            pathname: "/tools/ocr-tool",
                            params: { imageUri: uris[0] }
                        });
                    } else if (component?.endsWith(".QrReaderActivity")) {
                        router.push({
                            pathname: "/tools/qr-tool",
                            params: { mode: "read", imageUri: uris[0] }
                        });
                    } else if (component?.endsWith(".EditPdfActivity")) {
                         router.push({
                            pathname: "/tools/pdf-editor",
                            params: { sharedUri: uris[0] },
                        });
                    } else if (component?.endsWith(".ImportBackupActivity")) {
                         router.push({
                            pathname: "/backup/confirm-backup",
                            params: { fileUri: uris[0] },
                        });
                    } else {
                        const isPdf = uris[0]?.toLowerCase().endsWith('.pdf');
                        if (isPdf) {
                            router.push({
                                pathname: "/tools/pdf-editor",
                                params: { sharedUri: uris[0] }
                            });
                        } else {
                         router.push({
                            pathname: "/task/editor",
                            params: {
                                sharedImages: JSON.stringify(uris)
                            }
                         });
                        }
                    }
                }
            }
            resetShareIntent();
        }, 100);
      };
      
      handleShare();
    }
  }, [isAuthenticated, hasShareIntent, shareIntent, router, resetShareIntent, isNavigationReady]);

  if (securityEnabled && !isAuthenticated) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
         <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
         <View className="items-center p-8 bg-surface-secondary rounded-[3rem] border border-border mx-6">
            <View className="h-20 w-20 rounded-full items-center justify-center mb-6" style={{ backgroundColor: primaryColor + '20' }}>
               <Text className="text-4xl">🔒</Text>
            </View>
            <Text className="font-sans-bold text-2xl text-on-surface mb-2 text-center">App Bloqueado</Text>
            <Text className="font-sans text-on-surface-secondary mb-8 text-center px-4 leading-relaxed">Use sua biometria para acessar o Genly</Text>
            
            <TouchableOpacity 
                activeOpacity={0.7}
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

  if (!isNavigationReady || !fontsLoaded) {
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
            name="finance/editor"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DatabaseProvider>
        <ThemeProvider>
          <BottomSheetModalProvider>
            <DialogProvider>
              <RootLayoutNav />
            </DialogProvider>
          </BottomSheetModalProvider>
        </ThemeProvider>
      </DatabaseProvider>
    </GestureHandlerRootView>
  );
}
