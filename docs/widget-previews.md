# Gerar as prévias dos widgets

Execute na raiz do projeto:

```bash
npm run widgets:previews
```

É necessário ter Google Chrome ou Chromium instalado. Para escolher um executável
específico, defina `WIDGET_PREVIEW_BROWSER` com o caminho do navegador.
Não é necessário celular, emulador, Metro, captura de tela manual ou recorte.
O comando não compila o aplicativo e não publica nenhuma release.

## Origem das imagens

`scripts/widget-preview-renderer.cjs` carrega os componentes reais de `src/widgets`
e os renderiza com dados fictícios usando React. Apenas as primitivas FlexWidget,
ListWidget, TextWidget e SvgWidget são adaptadas para HTML/CSS. Os estilos, nomes,
cores, ícones e status vêm dos componentes do app. As quatro fontes Montserrat
são incorporadas ao documento, sem downloads ou dependência das fontes do sistema.

O Chrome headless rasteriza cada documento em 960 × 720 pixels, com fundo
transparente e escala 3×. A renderização no navegador pode ter pequenas diferenças
de métrica em relação ao TextView do Android; não substitui testar o widget real.
Os botões de adicionar usam SVG no app e na prévia, evitando desalinhamento por
baseline do caractere “+” da fonte.

São produzidos cinco arquivos:

- `assets/widget-preview/recent-tasks.png`
- `assets/widget-preview/reminders.png`
- `assets/widget-preview/mind-maps.png`
- `assets/widget-preview/flashcards.png`
- `assets/widget-preview/group.png`

A imagem de grupo usa “Meu grupo”, sem depender de um grupo predefinido “Trabalho”.
Os exemplos dos lembretes incluem “Amanhã” e “Expirado”, com datas relativas ao
momento da geração. Nenhuma nota ou dado pessoal do banco é usado.

Todos os PNGs são gerados e validados em um diretório temporário antes de substituir
os assets existentes. Se o Chrome falhar, as imagens anteriores são preservadas.
Os arquivos temporários e o perfil temporário do navegador são removidos ao final.

Se houver providers gerados em `android/app/src/main/res/xml`, o comando também
copia as imagens para os drawables Android correspondentes e sincroniza suas
referências `previewImage`. Isso permite compilar diretamente com Gradle.
O plugin `withWidgetLoadingLayouts` preserva essas imagens em futuros prebuilds,
sem um `previewLayout` antigo substituindo a imagem do widget de grupo.

## Fluxo de manutenção

1. Altere os componentes reais dos widgets.
2. Execute `npm run widgets:previews`.
3. Confira os PNGs e inclua-os no commit junto com o layout.
4. Compile e distribua o novo APK normalmente.

A instalação do APK é necessária para que o seletor do Android receba os assets
novos. O launcher pode manter uma prévia antiga em cache por algum tempo; fechar
e reabrir o seletor pode ser necessário. Este gerador atualiza os recursos estáticos
do APK, não usa a API de prévias dinâmicas do Android 15.

Para validar o gerador sem abrir o navegador:

```bash
node tests/widget-previews.test.cjs
```
