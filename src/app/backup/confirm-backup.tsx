import { Button } from "@/components/ui/Button";
import { useTheme } from "@/providers/ThemeProvider";
import { importBackup, validateBackupFile, type BackupPreview } from "@/services/backupService";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FileText,
  Image,
  Settings,
  XCircle,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Status = "validating" | "preview" | "importing" | "success" | "error";

export default function ConfirmBackupScreen() {
  const { fileUri } = useLocalSearchParams<{ fileUri: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { primaryColor, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [status, setStatus] = useState<Status>("validating");
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!fileUri) {
      setErrorMessage("Nenhum arquivo fornecido");
      setStatus("error");
      return;
    }

    validateBackupFile(fileUri)
      .then((result) => {
        setPreview(result);
        setStatus("preview");
      })
      .catch((err) => {
        setErrorMessage(err?.message ?? "Arquivo inválido");
        setStatus("error");
      });
  }, [fileUri]);

  const handleImport = async () => {
    if (!fileUri) return;
    setStatus("importing");
    try {
      await importBackup(fileUri);
      setStatus("success");
    } catch {
      setErrorMessage("Falha ao importar o backup");
      setStatus("error");
    }
  };

  const handleDone = () => {
    router.replace("/");
  };

  const handleCancel = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const formatDate = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoDate;
    }
  };

  const iconColor = primaryColor === "#000000" || primaryColor === "#000"
    ? (isDark ? "#FFF" : "#000")
    : primaryColor;

  const dangerColor = "#EF4444";

  return (
    <View
      className="flex-1 bg-surface justify-center px-6"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {/* Validating */}
      {status === "validating" && (
        <View className="items-center">
          <ActivityIndicator size="large" color={primaryColor} />
          <Text className="font-sans-bold text-lg text-on-surface mt-4">
            Validando arquivo...
          </Text>
          <Text className="font-sans text-on-surface-secondary mt-1 text-center">
            Verificando se o arquivo é um backup válido do Genly
          </Text>
        </View>
      )}

      {/* Preview / Confirmation */}
      {status === "preview" && preview && (
        <View>
          <View className="items-center mb-6">
            <View
              className="h-16 w-16 rounded-full items-center justify-center mb-3"
              style={{ backgroundColor: iconColor + "20" }}
            >
              <FileText size={32} color={iconColor} />
            </View>
            <Text className="font-sans-bold text-2xl text-on-surface text-center">
              Importar Backup
            </Text>
            <Text className="font-sans text-on-surface-secondary mt-1 text-center">
              Backup válido encontrado
            </Text>
          </View>

          {/* Details Card */}
          <View className="bg-surface-secondary rounded-3xl p-5 border border-border mb-4">
            <View className="flex-row items-center mb-4">
              <Calendar size={18} color={iconColor} />
              <Text className="font-sans text-on-surface-secondary ml-3 flex-1">
                Data
              </Text>
              <Text className="font-sans-bold text-on-surface text-sm">
                {formatDate(preview.exportedAt)}
              </Text>
            </View>

            <View className="flex-row items-center mb-4">
              <FileText size={18} color={iconColor} />
              <Text className="font-sans text-on-surface-secondary ml-3 flex-1">
                Notas
              </Text>
              <Text className="font-sans-bold text-on-surface">
                {preview.taskCount}
              </Text>
            </View>

            <View className="flex-row items-center mb-4">
              <Image size={18} color={iconColor} />
              <Text className="font-sans text-on-surface-secondary ml-3 flex-1">
                Mídias
              </Text>
              <Text className="font-sans-bold text-on-surface">
                {preview.mediaCount}
              </Text>
            </View>

            <View className="flex-row items-center">
              <Settings size={18} color={iconColor} />
              <Text className="font-sans text-on-surface-secondary ml-3 flex-1">
                Configurações
              </Text>
              <Text className="font-sans-bold text-on-surface">
                {preview.settingsCount}
              </Text>
            </View>
          </View>

          {/* Warning */}
          <View
            className="rounded-2xl p-4 mb-6 flex-row items-start"
            style={{ backgroundColor: dangerColor + "15" }}
          >
            <AlertTriangle size={20} color={dangerColor} style={{ marginTop: 2 }} />
            <Text
              className="font-sans text-sm ml-3 flex-1 leading-5"
              style={{ color: dangerColor }}
            >
              Todos os dados atuais serão substituídos permanentemente. Esta ação não pode ser desfeita.
            </Text>
          </View>

          {/* Actions */}
          <Button
            variant="danger"
            rounded="full"
            size="lg"
            onPress={handleImport}
            className="mb-3"
          >
            <Button.Text>Importar Backup</Button.Text>
          </Button>

          <Button variant="ghost" rounded="full" size="lg" onPress={handleCancel}>
            <Button.Text>Cancelar</Button.Text>
          </Button>
        </View>
      )}

      {/* Importing */}
      {status === "importing" && (
        <View className="items-center">
          <ActivityIndicator size="large" color={primaryColor} />
          <Text className="font-sans-bold text-lg text-on-surface mt-4">
            Importando backup...
          </Text>
          <Text className="font-sans text-on-surface-secondary mt-1 text-center">
            Restaurando notas, mídias e configurações
          </Text>
        </View>
      )}

      {/* Success */}
      {status === "success" && (
        <View className="items-center">
          <View
            className="h-16 w-16 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: "#22C55E20" }}
          >
            <CheckCircle2 size={32} color="#22C55E" />
          </View>
          <Text className="font-sans-bold text-2xl text-on-surface mb-1">
            Backup importado!
          </Text>
          <Text className="font-sans text-on-surface-secondary mb-8 text-center">
            Seus dados foram restaurados com sucesso
          </Text>
          <Button rounded="full" size="lg" onPress={handleDone}>
            <Button.Text>Concluir</Button.Text>
          </Button>
        </View>
      )}

      {/* Error */}
      {status === "error" && (
        <View className="items-center">
          <View
            className="h-16 w-16 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: dangerColor + "20" }}
          >
            <XCircle size={32} color={dangerColor} />
          </View>
          <Text className="font-sans-bold text-2xl text-on-surface mb-1">
            Arquivo inválido
          </Text>
          <Text className="font-sans text-on-surface-secondary mb-8 text-center px-4">
            {errorMessage}
          </Text>
          <Button rounded="full" size="lg" onPress={handleCancel}>
            <Button.Text>Voltar</Button.Text>
          </Button>
        </View>
      )}
    </View>
  );
}
