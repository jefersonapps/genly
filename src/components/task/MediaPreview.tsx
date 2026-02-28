import { MathJaxRenderer } from "@/components/ui/MathJaxRenderer";
import { TransparencyGrid } from "@/components/ui/TransparencyGrid";
import { useTheme } from "@/providers/ThemeProvider";
import { Image } from "expo-image";
import { FileText } from "lucide-react-native";
import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";

export interface MediaPreviewProps extends ViewProps {
  media: {
    uri: string;
    type: "image" | "latex" | "pdf";
    latexSource?: string | null;
    thumbnailUri?: string | null;
  };
  size?: number;
  rounded?: number;
  gridSize?: number;
  showGrid?: boolean;
}

export function MediaPreview({ 
  media, 
  size = 80, 
  rounded = 16, 
  gridSize = 12,
  showGrid = true,
  style, 
  ...props 
}: MediaPreviewProps) {
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === "dark";

  const isLocalUri = media.uri && (media.uri.startsWith('file://') || media.uri.startsWith('/'));

  const renderContent = () => {
    switch (media.type) {
      case "image":
        return (
          <Image
            source={{ uri: media.uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        );
      case "pdf":
        const pdfThumb = media.thumbnailUri || (media as any).thumbnail_uri;
        if (pdfThumb) {
          return (
            <Image
              source={{ uri: pdfThumb }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
            />
          );
        }
        return (
          <View style={styles.pdfContainer}>
            <FileText size={size * 0.5} color={primaryColor} />
          </View>
        );
      case "latex":
      default:
        return (
          <View style={styles.latexContainer}>
            {isLocalUri ? (
              <Image
                source={{ uri: media.uri }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
              />
            ) : (
              <View style={styles.mathJaxWrapper}>
                <MathJaxRenderer 
                  content={media.latexSource || ""} 
                  color={isDark ? "#FFFFFF" : "#000000"}
                  style={{ minHeight: size / 2 }} 
                />
              </View>
            )}
          </View>
        );
    }
  };

  return (
    <View 
      style={[
        styles.container, 
        { width: size, height: size, borderRadius: rounded }, 
        style
      ]} 
      {...props}
    >
      {showGrid && <TransparencyGrid size={gridSize} />}
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  latexContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pdfContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: 'transparent',
  },
  mathJaxWrapper: {
    padding: 4,
    width: '100%',
    height: '100%',
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  }
});
