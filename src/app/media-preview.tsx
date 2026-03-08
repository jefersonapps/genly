import { ImageZoom } from '@likashefqet/react-native-image-zoom';
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { Download, ExternalLink, Share2, X } from "lucide-react-native";
import React from "react";
import { FlatList, Platform, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MediaPreview } from "@/components/task/MediaPreview";
import { Button } from "@/components/ui/Button";
import { TransparencyGrid } from "@/components/ui/TransparencyGrid";
import { useTheme } from "@/providers/ThemeProvider";
import { shadows } from "@/theme/shadows";
import ReactNativeBlobUtil from 'react-native-blob-util';

const CarouselItem = React.memo(({ item, width, height, onOpenDocument }: { item: { uri: string; type: string; thumbnailUri?: string }, width: number, height: number, onOpenDocument: (uri: string) => void }) => {
    if (item.type === 'pdf') {
        const mediaData = {
            uri: item.uri,
            type: 'pdf' as const,
            thumbnailUri: item.thumbnailUri
        };

        return (
            <View style={{ width, height, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
                <MediaPreview 
                    media={mediaData} 
                    size={Math.min(width, height) * 0.8} 
                    showGrid={false}
                    style={{ width, height }}
                />
                
                <View className="absolute bottom-32">
                    <Button 
                        onPress={() => onOpenDocument(item.uri)}
                        variant="filled"
                        className="px-8 py-4 rounded-full flex-row items-center gap-2"
                        style={shadows.lg}
                    >
                        <ExternalLink size={20} color="#FFF" />
                        <Button.Text>Abrir Documento</Button.Text>
                    </Button>
                </View>
            </View>
        );
    }

    return (
        <View 
            style={{ 
                width, 
                height,
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            <ImageZoom 
                uri={item.uri} 
                minScale={1} 
                maxScale={5} 
                style={{ 
                    width, 
                    height,
                    backgroundColor: 'transparent' 
                }}
            />
        </View>
    );
});

export default function MediaPreviewScreen() {
    const router = useRouter();
    const { uri, index, mediaItems: mediaItemsJson, type, thumbnailUri } = useLocalSearchParams<{ 
        uri?: string; 
        index?: string; 
        mediaItems?: string;
        type?: string;
        thumbnailUri?: string;
    }>();
    
    const insets = useSafeAreaInsets();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    // Parse media items or fallback to single uri
    const mediaItems = React.useMemo(() => {
        if (mediaItemsJson) {
            try {
                const items = JSON.parse(mediaItemsJson) as any[];
                return items.map(item => ({
                    uri: item.uri,
                    type: item.type,
                    thumbnailUri: item.thumbnailUri || item.thumbnail_uri || (item as any).thumbnailUri
                }));
            } catch (e) {
                console.error("Failed to parse mediaItems", e);
            }
        }
        const fallbackThumbnail = thumbnailUri || (useLocalSearchParams() as any).thumbnail_uri;
        return uri ? [{ uri, type: (type as any) || 'image', thumbnailUri: fallbackThumbnail }] : [];
    }, [mediaItemsJson, uri, type, thumbnailUri]);

    const initialIndex = React.useMemo(() => {
        const idx = index ? parseInt(index, 10) : 0;
        return isNaN(idx) ? 0 : idx;
    }, [index]);

    const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
    const scrollRef = React.useRef<FlatList>(null);

    const currentItem = mediaItems[currentIndex];
    
    const handleShare = async () => {
        if (!currentItem?.uri) return;
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(currentItem.uri);
        }
    };

    const handleSave = async () => {
        if (!currentItem?.uri) return;
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status === 'granted') {
                await MediaLibrary.saveToLibraryAsync(currentItem.uri);
                alert("Salvo na galeria!");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleOpenDocument = async (uri: string) => {
        try {
            const cleanPath = uri.replace('file://', '');
            if (Platform.OS === 'android') {
                await ReactNativeBlobUtil.android.actionViewIntent(cleanPath, 'application/pdf');
            } else if (Platform.OS === 'ios') {
                await ReactNativeBlobUtil.ios.openDocument(cleanPath);
            }
        } catch (e) {
            console.log("Falha ao abrir externamente, usando visualizador interno", e);
            router.push({
                pathname: "/pdf-viewer",
                params: { uri }
            } as any);
        }
    };

    const renderItem = React.useCallback(({ item }: { item: { uri: string; type: string; thumbnailUri?: string } }) => (
        <CarouselItem item={item} width={windowWidth} height={windowHeight} onOpenDocument={handleOpenDocument} />
    ), [windowWidth, windowHeight]);

    const handleScroll = React.useCallback((e: any) => {
        const newIndex = Math.round(e.nativeEvent.contentOffset.x / windowWidth);
        if (newIndex !== currentIndex && newIndex >= 0 && newIndex < mediaItems.length) {
            setCurrentIndex(newIndex);
        }
    }, [windowWidth, currentIndex, mediaItems.length]);

    return (
        <View className="flex-1 bg-surface relative">
            <TransparencyGrid size={24} opacity={0.4} />
            
            <View 
                className="absolute top-0 left-0 right-0 z-10 flex-row justify-between px-4 pb-4"
                style={{ paddingTop: insets.top + 10 }}
            >
                <Button 
                    variant="icon" 
                    onPress={() => router.back()} 
                    className="h-12 w-12 rounded-full bg-surface-secondary/80"
                >
                    <Button.Icon icon={<X color={isDark ? "#FAFAFA" : "#18181B"} size={24} />} />
                </Button>

                <View className="flex-row gap-3">
                     <Button 
                        variant="icon" 
                        onPress={handleSave} 
                        className="h-12 w-12 rounded-full bg-surface-secondary/80"
                    >
                        <Button.Icon icon={<Download color={isDark ? "#FAFAFA" : "#18181B"} size={22} />} />
                    </Button>
                     <Button 
                        variant="icon" 
                        onPress={handleShare} 
                        className="h-12 w-12 rounded-full bg-surface-secondary/80"
                    >
                        <Button.Icon icon={<Share2 color={isDark ? "#FAFAFA" : "#18181B"} size={22} />} />
                    </Button>
                </View>
            </View>

            <View className="flex-1">
                <FlatList
                    ref={scrollRef}
                    data={mediaItems}
                    renderItem={renderItem}
                    keyExtractor={(item, idx) => `${item.uri}-${idx}`}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    initialScrollIndex={initialIndex}
                    getItemLayout={(_, index) => ({
                        length: windowWidth,
                        offset: windowWidth * index,
                        index: index!,
                    })}
                    onMomentumScrollEnd={handleScroll}
                    onScrollToIndexFailed={(info) => {
                        const wait = new Promise(resolve => setTimeout(resolve, 100));
                        wait.then(() => {
                            scrollRef.current?.scrollToIndex({ index: info.index, animated: false });
                        });
                    }}
                    windowSize={3}
                    initialNumToRender={1}
                    maxToRenderPerBatch={1}
                    removeClippedSubviews={true}
                    decelerationRate="fast"
                />
            </View>
            
            {mediaItems.length > 1 && (
                <View 
                    style={{ bottom: insets.bottom + 40 }}
                    className="absolute left-0 right-0 items-center"
                >
                    <View className="bg-surface-secondary/80 px-4 py-1.5 rounded-full">
                        <Text className="text-on-surface-secondary font-sans-bold text-xs">
                            {currentIndex + 1} / {mediaItems.length}
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
}
