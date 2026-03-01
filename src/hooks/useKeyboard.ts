import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Hook to track whether the keyboard is currently visible.
 * Useful for conditional rendering of UI elements that should hide when typing.
 */
export function useKeyboard() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () => {
      setIsVisible(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return { isVisible };
}
