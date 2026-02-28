import React, { createContext, useContext, type PropsWithChildren } from "react";
import { View, Text } from "react-native";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { db } from "../db/client";
import migrations from "../../drizzle/migrations";

interface DatabaseContextValue {
  isReady: boolean;
}

const DatabaseContext = createContext<DatabaseContextValue>({ isReady: false });

export function DatabaseProvider({ children }: PropsWithChildren) {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "red", fontSize: 16 }}>
          Erro no banco de dados: {error.message}
        </Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#888", fontSize: 16 }}>Carregando...</Text>
      </View>
    );
  }

  return (
    <DatabaseContext.Provider value={{ isReady: true }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase(): DatabaseContextValue {
  return useContext(DatabaseContext);
}
