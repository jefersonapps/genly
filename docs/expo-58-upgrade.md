# Atualização para Expo SDK 58

## Versões e compatibilidade

As versões dos módulos Expo e das bibliotecas nativas incluídas no SDK seguem
`expo/bundledNativeModules.json` do Expo 58.0.22. O lockfile é parte da atualização.

| Componente | Versão selecionada |
| --- | --- |
| Expo | 58.0.22 |
| React / React DOM | 19.3.0 |
| React Native | 0.88.1 |
| Reanimated / Worklets | 4.7.1 / 0.13.0 |
| Gesture Handler | ~3.3.0 |
| Skia | 2.14.0 |
| Expo Share Intent | 9.0.0, compatível oficialmente com SDK 58 |
| Editor HTML | react-native-enriched-html 1.2.0 |
| Markdown | 1.1.1 estável, substituindo o nightly antigo |
| TypeScript | ~6.0.3, conforme o template do SDK 58 |
| NativeWind / Tailwind | 4.2.7 / 3.4.19 |
| ESLint | 9.39.5 |

Tailwind permanece na série 3 para preservar a integração do NativeWind 4.
ESLint permanece na série 9 porque os plugins React e Import usados pelo Expo
não declaram suporte ao ESLint 10. TypeScript segue o template Expo, e não a
versão 7, fora da faixa suportada pelo typescript-eslint instalado.
React, React DOM e bibliotecas nativas seguem a matriz do SDK mesmo quando
há uma versão mais recente no npm.

`react-native-enriched` foi substituído pelo sucessor oficial
`react-native-enriched-html`. As extensões opcionais de menu do Tiptap foram
alinhadas à versão 3.31.3 usada pelo editor para evitar peers incompatíveis.
`expensify-common` e `expo-atlas`, sem referências no projeto, foram removidos:
traziam respectivamente React 16 e expo-server do SDK 57.

## Adaptações do aplicativo

- A barra de abas usa os tipos de `expo-router/tabs` e `navigateToTab(route.key)`.
- Referências de componentes usam os tipos de instância da API estrita do RN.
- Os caminhos do Skia usam `PathBuilder` e são finalizados em caminhos imutáveis;
  a borracha de PDF usa `Skia.Path.Stroke`.
- As gravações por `File.write()` são aguardadas antes de retornar o URI.
- Os fluxos existentes de galeria usam `expo-media-library/legacy`, preservando
  as APIs de permissões, criação de assets e salvamento utilizadas pelo app.
- O override de Kotlin 2.0.20 foi removido para usar a versão do SDK.
- A minificação de release permanece desativada, como no projeto anterior.
  Isso evita ativar automaticamente o R8, novo padrão do template SDK 58,
  junto com a migração das dependências.
- O editor PDF usa o wrapper de plataforma já existente, evitando importar seu
  componente Fabric nativo na compilação web.
- A saída web permanece explicitamente `single` para preservar a SPA anterior,
  pois o Router 58 passou a usar saída `server` por padrão.
- O módulo Wi-Fi recebeu um patch para passar os nomes das propriedades do SDK
  como strings no Gradle 9; os pacotes com patches têm versões exatas.
- A extração de paletas trata o bitmap opcional do Fresco com acesso seguro,
  compatível com as novas anotações de nulidade do SDK Android.
- Os patches de transparência PNG e dos destinos de compartilhamento foram
  preservados. Os patches de CSS Interop e PDF Thumbnail foram removidos porque
  as versões atualizadas incorporam as correções.
- `postinstall` falha se um patch deixar de aplicar, em vez de continuar com
  comportamento nativo diferente do esperado.

## Correção de 16 KB

O APK debug anterior continha 36 bibliotecas ARM64. A verificação de segmentos
ELF e entradas ZIP identificou `libxeno_native.so` com alinhamento de 4 KB e
offsets incompatíveis. Ela vinha de `mediapipe-internal:17.0.0-beta6`, dependência
de `segmentation-selfie:16.0.0-beta4` na biblioteca de remoção de fundo.
O patch atualiza `segmentation-selfie` para `16.0.0-beta6`, que inclui suporte a
16 KB e passa a usar `mediapipe-internal:17.0.0-beta10`. A inspeção dos dois AARs
confirmou que o binário antigo falha em ARM64/x86_64 e o novo passa em ambas. As outras 35 bibliotecas ARM64 daquele APK passaram na verificação;
isso não permite concluir que o binário instalado na captura seja idêntico.

O verificador incluído examina **todas** as bibliotecas `arm64-v8a` e `x86_64`
do APK final: alinhamento dos segmentos LOAD, congruência dos endereços/offsets
e posição de dados das entradas ZIP não comprimidas. Ele retorna erro se não
encontrar bibliotecas de 64 bits ou se alguma falhar. Não modifica os binários.

```bash
python3 scripts/test-android-16kb.py
pnpm check:android:16kb android/app/build/outputs/apk/release/app-release.apk
```

## Instalação e compilação

Use Node 22.13+ na série 22 ou Node 24.3+ na série 24, e o pnpm fixado em
`packageManager`. As pastas Android/iOS são geradas e ignoradas pelo Git;
precisam ser regeneradas também em outros checkouts que ainda tenham o SDK 55.
Preserve configurações de assinatura locais antes de regenerar essas pastas.

```bash
corepack pnpm install --frozen-lockfile
pnpm typecheck
pnpm exec expo install --check
pnpm exec expo prebuild --clean --no-install
cd android
./gradlew assembleRelease
cd ..
pnpm check:android:16kb android/app/build/outputs/apk/release/app-release.apk
```

O SDK 58 exige iOS 16.4 ou posterior. A compilação iOS requer macOS/Xcode.
O projeto inclui módulos nativos personalizados e requer uma compilação própria.

## Validações executadas

- TypeScript sem erros, incluindo a resolução do wrapper PDF que já falhava antes.
- `expo install --check` aprovado contra a matriz online do Expo.
- Lockfile validado com `--offline --frozen-lockfile --lockfile-only`.
- Exportação de produção com Hermes aprovada para Android e iOS.
- Exportação web aprovada com saída SPA.
- Quatro patches aplicados com sucesso em cópias limpas dos pacotes.
- Seis testes do verificador de ELF/ZIP aprovados.
- Compilação Android de release aprovada com R8 desativado:
  `./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64 --max-workers=4`.
- APK final: 82 bibliotecas ARM64/x86_64 verificadas, nenhuma falha de 16 KB;
  `zipalign -c -P 16 -v 4` também aprovado.
  Artefato: `android/app/build/outputs/apk/release/app-release.apk`.
  As ABIs de 32 bits não fizeram parte desta compilação de validação.
- Expo Doctor: 19 de 20 verificações aprovadas; os avisos restantes estão abaixo.
- O lint geral ainda reprova em código existente, inclusive arquivos de terceiros
  versionados e regras do React Compiler. A comparação dos arquivos alterados com
  suas versões anteriores, usando a mesma configuração atual de ESLint, não
  encontrou novas categorias de erro.

O aparelho conectado durante a atualização reportou `PAGE_SIZE=4096`.
A execução em páginas de 16 KB e os testes funcionais abaixo permanecem pendentes;
a exportação iOS não equivale a uma compilação nativa com Xcode.

## Verificação funcional no dispositivo

Além das verificações de compilação, validar em um dispositivo/emulador com
`adb shell getconf PAGE_SIZE` retornando `16384`:

- Abrir o app e alternar entre todas as abas.
- Criar, formatar, salvar e reabrir notas antigas e novas; renderizar Markdown e LaTeX.
- Desenhar e apagar no PDF; gerar miniaturas, exportar e reabrir o documento.
- Editar e exportar mapas mentais, incluindo linhas, conexões e imagens.
- Executar OCR, scanner, leitura de códigos e remoção de fundo com transparência.
- Salvar na galeria e receber texto, imagem e PDF pelos destinos de compartilhamento.
- Criar e atualizar os cinco widgets; agendar e receber lembretes.
- Criar e restaurar um backup com anexos e testar autenticação biométrica.

O Expo Doctor ainda aponta ausência de metadados para remoção de fundo e
PDF Thumbnail, e ausência de confirmação da New Architecture no cadastro das
duas bibliotecas ML Kit. Esses avisos não foram ocultados. Compilar e verificar
ELF não substitui os testes funcionais acima.

## Referências

- [Expo SDK 58](https://expo.dev/changelog/sdk-58)
- [Migração do Expo SDK](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- [Alinhamento de 16 KB no Android](https://developer.android.com/guide/practices/page-sizes)
- [Versões do ML Kit](https://developers.google.com/ml-kit/release-notes)
- [Compatibilidade do Enriched Markdown](https://docs.swmansion.com/enriched-markdown/misc/compatibility/)
