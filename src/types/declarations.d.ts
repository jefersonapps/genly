declare module "@likashefqet/react-native-image-zoom" {
  import React from "react";
    import { StyleProp, ViewStyle } from "react-native";

  export interface ImageZoomProps {
    uri: string;
    minScale?: number;
    maxScale?: number;
    style?: StyleProp<ViewStyle>;
    onInteractionStart?: () => void;
    onInteractionEnd?: () => void;
    onPinchStart?: () => void;
    onPinchEnd?: () => void;
    onPanStart?: () => void;
    onPanEnd?: () => void;
  }

  export const ImageZoom: React.FC<ImageZoomProps>;
}
