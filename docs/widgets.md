# Widgets: abertura e carregamento

## Navegação

A pilha principal usa a home (`(tabs)`) como `anchor` do Expo Router 58. Assim,
abrir uma nota, um editor ou uma ferramenta por link também cria um destino
para o botão Voltar, inclusive com o app fechado.

Os links dos cinco widgets passam `source=widget` e preservam os parâmetros de
nota, grupo e lembrete. Ao sair dessas telas, o app remove o histórico acima da
home. A criação de uma nota pelo widget também retorna à home após salvar.
Uma edição iniciada dentro do app continua voltando para a nota anterior.
O botão Voltar do Android usa a mesma regra quando a tela está em foco.

Links de widgets antigos continuam tendo retorno seguro. Os widgets instalados
são atualizados na inicialização do app, e o link inicial já consumido é limpo
para evitar sua repetição ao reiniciar o JavaScript. Respostas antigas de
notificações são consumidas uma vez e não substituem um link explícito recebido.

Se a nota tiver sido excluída, a tela informa isso e oferece retorno à home,
em vez de exibir uma tela vazia. O editor limpa o formulário ao receber uma
abertura de nova nota e ignora carregamentos antigos de uma tela já abandonada.

## Inicialização dos widgets

O Android pode executar `index.ts` apenas para uma tarefa de widget, sem abrir
nenhuma Activity. A entrada agora registra essas tarefas e adia a importação do
roteador, das telas, do CSS e da configuração até a interface ser solicitada.
O componente `src/App.tsx` usa `ExpoRoot` e o contexto de rotas em um módulo
separado. iOS e web continuam usando a entrada padrão do Expo Router.

Os componentes dos widgets usam `@jsxImportSource react` e `use no memo`, sem
carregar o runtime do NativeWind nem inserir hooks do React Compiler na árvore
que a biblioteca converte em RemoteViews. A tela de configuração mantém seu CSS.

As consultas retornam somente ID, título e datas, evitando transportar corpos
HTML, JSON de mapas e anexos para desenhar uma lista de títulos. A consulta de
notas exclui os grupos especiais em uma única operação. Tema e conteúdo são
solicitados juntos, e somente widgets de grupo consultam a configuração da
instância. Configurar um grupo atualiza esse widget, sem redesenhar os demais.

O plugin `withWidgetLoadingLayouts` roda na etapa final do prebuild, depois de a
biblioteca gerar os providers. Ele associa os cinco widgets a layouts nativos
com título e indicador de carregamento, com cores para os modos claro e escuro.
Isso elimina o retângulo transparente enquanto o Android inicia a tarefa JS.
Se o banco ainda não estiver disponível, o widget oferece abrir o app para
preparar os dados.

Esse layout inicial é uma apresentação de carregamento; os títulos reais das
notas continuam vindo do banco. O tempo final depende também da inicialização
do React Native e do agendamento do Android. Não há medição de latência real
no dispositivo nesta validação.

## Verificação

```bash
pnpm typecheck
pnpm test:widget-navigation
pnpm test:widget-startup
pnpm exec expo prebuild --platform android --no-clean --no-install
cd android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64 --max-workers=4
```

Os testes cobrem 13 cenários com os construtores de estado e o reducer reais
do Expo Router, além de 7 cenários de inicialização, JSX de produção, consultas
SQLite reais, erro de banco e geração idempotente dos layouts nativos.

Validação desta alteração: TypeScript, os 20 testes, exportação web e compilação
Android de release aprovados. O APK contém os cinco layouts nativos, e o provider
de notas aponta para o layout inicial correspondente. As 82 bibliotecas ARM64 e
x86_64 passaram na verificação ELF de 16 KB; `zipalign -c -P 16 -v 4` também passou.
Artefato: `android/app/build/outputs/apk/release/app-release.apk`.

Como há novos recursos nativos, é necessário instalar uma nova compilação;
atualizar somente o JavaScript não atualiza o layout inicial do launcher.
No aparelho, conferir abertura com o app fechado e aberto, retorno pelo cabeçalho
e pelo botão Android, criação de notas com grupo/lembrete, nota excluída e
adição/redimensionamento dos cinco widgets nos modos claro e escuro.

Referências: [anchor do Expo Router](https://docs.expo.dev/router/advanced/router-settings/),
[entrada personalizada](https://docs.expo.dev/router/reference/troubleshooting/),
[ações dos widgets](https://saleksovski.github.io/react-native-android-widget/docs/public-api/interfaces/ClickActionProps).
