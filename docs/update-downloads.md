# Downloads de atualização no Android

O módulo local `modules/genly-updates` delega a transferência ao `DownloadManager`
do Android. O app persiste o ID e os dados da release em SharedPreferences e
consulta o mesmo download na próxima inicialização. A mudança exige um novo APK;
recarregar o JavaScript de um APK antigo não adiciona o módulo nativo.

Expo Autolinking reconhece o módulo automaticamente em `modules/`. Não é necessário
instalar outra dependência. Compile o APK normalmente, preservando a assinatura
usada na versão já publicada.

O Android gerencia a transferência e sua notificação, inclusive com o JavaScript
suspenso. O app consulta bytes e status a cada segundo enquanto está visível,
para a consulta ao entrar em segundo plano e recupera o estado ao voltar.
O SO pode aguardar conexão/Wi-Fi ou repetir uma solicitação; a retomada parcial
continua dependente do servidor. Forçar parada, desinstalar o aplicativo ou remover
seus dados não equivale a apenas colocá-lo em segundo plano.

Os arquivos ficam na pasta externa específica do app, não na pasta pública de
Downloads. A limpeza remove somente o ID persistido e APKs deste módulo.
Downloads comuns do usuário não são removidos. Ao abrir uma versão já atualizada,
o APK anterior é removido. Nenhuma tarefa ativa é substituída por uma nova consulta
de releases ou por um segundo toque em baixar.

A barra usa dimensões explícitas. O percentual é calculado com bytes consultados
no Android e, enquanto o servidor não informa o total, com o tamanho do asset
retornado pelo GitHub. Sem nenhum total conhecido, a interface mostra atividade
e bytes recebidos. Somente o status de sucesso exibe 100%. Arquivos ausentes,
vazios ou com tamanho diferente do asset não são considerados prontos.

Ao concluir, a tela oferece **Instalar atualização**. O instalador só é aberto
por ação explícita, nunca automaticamente em segundo plano. Se faltar autorização
para instalar apps pelo Genly, abre-se a configuração do Android; ao voltar, o APK
continua disponível para uma nova tentativa, sem baixar novamente.

## Verificação

```bash
node tests/app-update-errors.test.cjs
node tests/update-download.test.cjs
node tests/update-download-monitor.test.cjs
npx tsc --noEmit --pretty false
```

Os testes de JS substituem a fronteira nativa. No novo APK, verificar no aparelho:

1. Iniciar um download, confirmar barra, percentual e bytes recebidos.
2. Trocar de app; confirmar a notificação de download do Android e retornar.
3. Deixar o Android encerrar o processo e reabrir: recuperar o mesmo download.
4. Desligar e religar a internet: mostrar espera ou retomada sem modal global.
5. Concluir em segundo plano e retornar: oferecer instalação sem reiniciar download.
6. Negar/liberar a instalação de fontes desconhecidas; tentar instalar novamente.
7. Cancelar durante o início do download; confirmar que nenhuma tarefa fica órfã.
8. Instalar a atualização, reabrir e confirmar a limpeza do APK anterior.
