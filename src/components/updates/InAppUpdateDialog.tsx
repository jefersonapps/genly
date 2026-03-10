import { Dialog } from "@/components/ui/Dialog";
import { useTheme } from "@/providers/ThemeProvider";
import { useAppUpdateStore } from "@/store/useAppUpdateStore";
import { AlertCircle, Download } from "lucide-react-native";
import React, { useEffect } from "react";
import { Text, View } from "react-native";

export function InAppUpdateDialog() {
  const { primaryColor } = useTheme();
  
  const hasUpdate = useAppUpdateStore((s) => s.hasUpdate);
  const updateInfo = useAppUpdateStore((s) => s.updateInfo);
  const downloadError = useAppUpdateStore((s) => s.downloadError);
  const downloadAndInstall = useAppUpdateStore((s) => s.downloadAndInstall);
  const checkUpdates = useAppUpdateStore((s) => s.checkForUpdates);

  // We use our own local state to control the dialog visibility,
  // since 'hasUpdate' in the store persists, we don't want to trap the user
  const [visible, setVisible] = React.useState(false);
  const [errorVisible, setErrorVisible] = React.useState(false);

  useEffect(() => {
    // Only auto-show if we have an update
    if (hasUpdate && updateInfo) {
      setVisible(true);
    }
  }, [hasUpdate, updateInfo]);

  useEffect(() => {
     if (downloadError) {
        setErrorVisible(true);
     }
  }, [downloadError]);

  const handleUpdate = () => {
    setVisible(false);
    downloadAndInstall();
  };

  const handleLater = () => {
    setVisible(false);
  };

  const handleRetryError = () => {
      setErrorVisible(false);
      downloadAndInstall();
  };

  const handleCloseError = () => {
      setErrorVisible(false);
  };

  return (
    <>
      {/* UPDATE DIALOG */}
      <Dialog visible={visible} onClose={handleLater}>
        <Dialog.Header>
          <Dialog.Title icon={<Download color={primaryColor} size={24} />}>
            Atualização Disponível
          </Dialog.Title>
          <Dialog.Description>
            {`A versão ${updateInfo?.version || "mais recente"} do Genly está disponível! Gostaria de baixar e instalar a nova versão agora? O download acontecerá em segundo plano.`}
          </Dialog.Description>
          
          {updateInfo?.releaseNotes ? (
             <View className="bg-surface-secondary p-3 rounded-xl mb-4 max-h-40 overflow-hidden">
                <Text className="font-sans text-sm text-on-surface-secondary" numberOfLines={5}>
                    {updateInfo.releaseNotes}
                </Text>
             </View>
          ) : null}

        </Dialog.Header>
        <Dialog.Footer>
          <Dialog.Button variant="ghost" onPress={handleLater}>
            Lembrar depois
          </Dialog.Button>
          <Dialog.Button variant="default" onPress={handleUpdate}>
            Atualizar Agora
          </Dialog.Button>
        </Dialog.Footer>
      </Dialog>

      {/* ERROR DIALOG */}
      <Dialog visible={errorVisible} onClose={handleCloseError}>
        <Dialog.Header>
           <Dialog.Title icon={<AlertCircle color="#EF4444" size={24} />}>
               Falha na Atualização
           </Dialog.Title>
           <Dialog.Description>
               {downloadError || "Ocorreu um erro ao tentar baixar a atualização. O arquivo pode estar corrompido ou houve perda de conexão."}
           </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
           <Dialog.Button variant="ghost" onPress={handleCloseError}>
               Cancelar
           </Dialog.Button>
           <Dialog.Button variant="default" onPress={handleRetryError}>
               Tentar Novamente
           </Dialog.Button>
        </Dialog.Footer>
      </Dialog>
    </>
  );
}
