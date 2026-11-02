# Salvamento automático de mapas mentais

O editor salva após 350 ms sem alterações, serializa gravações e reaproveita o ID
criado no primeiro salvamento. Voltar pela seta ou pelo botão Android aguarda a
gravação pendente. Entrar em segundo plano e perder o foco também solicita a
conclusão da gravação. A sessão anterior deixa de observar o store global antes
de outro mapa ser carregado.

Somente mapas com texto real ou imagens podem ser gravados. Textos padrão como
“Ideia Central” e “Novo tópico”, espaços e textos vazios não contam como conteúdo.
A validação se aplica tanto à criação quanto à atualização. Se um mapa já salvo
ficar vazio, a última versão com conteúdo é preservada e o editor mostra
**Mapa vazio — não salvo**. Isso não exclui automaticamente mapas existentes.

O botão “+” dos widgets envia uma intenção de criação; `+native-intent.tsx`
atribui uma sessão nova para cada abertura, inclusive em links antigos dos widgets.
Entradas que contêm um `taskId` para visualizar um mapa existente são preservadas.

## Avisos de desenvolvimento

Os hooks do Reanimated em `MindMapCanvas.tsx` e no editor inline recebem listas de
dependências somente na web. Em Android/iOS, recebem `undefined`, conforme a API
atual do Reanimated. As capturas dos worklets continuam sendo transformadas pelo
plugin do projeto.

O patch `react-native-css-interop+0.2.7.patch` remove o registro automático de
`ImageBackground` do bootstrap do NativeWind, componente não utilizado pelo app.
Não suprime outros avisos. O patch altera tanto a fonte quanto a saída JS da
biblioteca e é reaplicado pelo `postinstall` com patch-package. Reinicie o Metro
com cache limpo para que o bootstrap seja recarregado:

```bash
npx expo start --clear
```

`INFO Launching DevTools...` é a abertura intencional do depurador configurada no
modo de desenvolvimento. Não indica falha e não altera a compilação de produção.

## Verificação

```bash
node tests/mind-map-autosave.test.cjs
node tests/nativewind-bootstrap.test.cjs
npx tsc --noEmit --pretty false
```

Os testes cobrem gravação automática, novas edições durante a criação, conteúdo
apagado antes e durante a gravação, atualizações vazias de IDs existentes, repetição
de links dos widgets e a inicialização do NativeWind sem acessar o getter
`ImageBackground`. O comportamento visual e os gestos precisam ser conferidos no
aparelho; não é necessário gerar um build para verificar essas alterações de JS
no aplicativo de desenvolvimento já instalado.
