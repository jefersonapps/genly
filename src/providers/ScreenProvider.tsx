import React, { createContext, useCallback, useMemo, useState } from "react";
import { View } from "react-native";

export const ScreenContext = createContext<{
  screenRef: React.RefObject<View | null>;
  setScreenRef: (view: View | null) => void;
  isReady: boolean;
}>({ 
  screenRef: { current: null }, 
  setScreenRef: () => {},
  isReady: false 
});

export const ScreenProvider = ({ children }: { children: React.ReactNode }) => {
  const [screenNode, setScreenNode] = useState<View | null>(null);

  const setScreenRef = useCallback((view: View | null) => {
    if (view) {
      setScreenNode(view);
    }
  }, []);

  const screenRef = useMemo(() => ({ current: screenNode }), [screenNode]);
  const isReady = screenNode !== null;

  const value = useMemo(() => ({ screenRef, setScreenRef, isReady }), [screenRef, setScreenRef, isReady]);

  return (
    <ScreenContext.Provider value={value}>
      {children}
    </ScreenContext.Provider>
  );
};
