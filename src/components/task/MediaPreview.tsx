import { TransparencyGrid } from "@/components/ui/TransparencyGrid";
import { useTheme } from "@/providers/ThemeProvider";
import { Image } from "expo-image";
import { FileText } from "lucide-react-native";
import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";
import { EnrichedMarkdownText } from "react-native-enriched-markdown";

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
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
          />
        );
      case "pdf":
        const pdfThumb = media.thumbnailUri || (media as any).thumbnail_uri;
        if (pdfThumb) {
          return (
            <Image
              source={{ uri: pdfThumb }}
              style={StyleSheet.absoluteFillObject}
              contentFit="contain"
            />
          );
        }
        return (
          <View className="flex-1 items-center justify-center bg-transparent">
            <FileText size={size * 0.5} color={primaryColor} />
          </View>
        );
      case "latex":
      default:
        return (
          <View className="flex-1 items-center justify-center">
            {isLocalUri ? (
              <Image
                source={{ uri: media.uri }}
                style={StyleSheet.absoluteFillObject}
                contentFit="contain"
              />
            ) : (
              <View className="p-1 w-full h-full items-center justify-center overflow-hidden">
                <EnrichedMarkdownText 
                  flavor="github"
                  markdown={media.latexSource || ""} 
                  markdownStyle={{
                      paragraph: {
                          color: isDark ? "#FFFFFF" : "#000000",
                      },
                      math: {
                          color: isDark ? "#FFFFFF" : "#000000",
                          fontSize: 14,
                          backgroundColor: "transparent",
                      } as any,
                      inlineMath: {
                          color: isDark ? "#FFFFFF" : "#000000",
                          backgroundColor: "transparent",
                      } as any
                  }}
                />
              </View>
            )}
          </View>
        );
    }
  };

  return (
    <View 
      className="overflow-hidden border border-black/5"
      style={[
        { width: size, height: size, borderRadius: rounded, backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF' }, 
        style
      ]} 
      {...props}
    >
      <View style={StyleSheet.absoluteFill}>
        {showGrid && <TransparencyGrid size={gridSize} />}
      </View>
      <View style={StyleSheet.absoluteFill}>
        {renderContent()}
      </View>
    </View>
  );
}
