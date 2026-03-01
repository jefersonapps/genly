import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import React, { createContext, useContext, type PropsWithChildren } from "react";
import { Text, View } from "react-native";
import migrations from "../../drizzle/migrations";
import { db } from "../db/client";

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
    return null
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
