# Widgets personalizados por grupo

Na biblioteca, abra um grupo e toque em **Widget** ao lado do título da
listagem. Em launchers Android compatíveis, o sistema abre sua confirmação para
adicionar o widget à tela inicial. Aceitar a solicitação da API não significa que
o usuário confirmou: por isso o app não anuncia que o widget já foi adicionado.
Se o launcher não suporta a solicitação, a interface orienta a adicionar
**Genly - Meu grupo** pelo seletor de widgets e escolher um grupo manualmente.

O provedor `GroupWidget` foi preservado para não invalidar widgets instalados.
Ele não é fixo para um grupo “Trabalho”: essa era a imagem de prévia antiga, que
foi substituída pela prévia genérica “Meu grupo”, gerada a partir do componente
real pelo comando `npm run widgets:previews`. Na confirmação iniciada pelo app,
a prévia nativa mostra o nome do grupo escolhido. O widget real mantém o layout existente de lista de notas,
com nome, ícone e cor do grupo e o botão para criar conteúdo no grupo correto.

O módulo local `modules/genly-widgets` é registrado pelo Expo Autolinking.
O callback nativo de confirmação recebe o ID real do novo widget e persiste a
associação com o grupo nas opções do AppWidgetManager. A associação é por instância,
não por uma variável global de “último grupo”. Cada solicitação usa um PendingIntent
explícito e único. Assim, grupos diferentes não compartilham sua configuração e
não é necessário que a tela React continue aberta quando a confirmação chegar.

A configuração manual existente em SQLite é preservada e tem precedência quando
o usuário reconfigura um widget. Sem uma configuração válida, o widget orienta
escolher um grupo em vez de mostrar automaticamente o primeiro grupo ou todas as
notas. Isso também se aplica a grupos excluídos. Ao remover um widget, sua chave
de configuração em SQLite é removida.

O módulo novo e a mudança da prévia exigem um novo APK. Para outros checkouts,
regenere o Android com `npx expo prebuild --platform android --no-install` antes
de compilar, preservando a configuração de assinatura da versão publicada.
O plugin `withWidgetLoadingLayouts` aplica a prévia em futuras gerações nativas.

## Verificação

```bash
node tests/group-widgets.test.cjs
node tests/widget-startup.test.cjs
node --experimental-strip-types --experimental-test-module-mocks tests/widget-navigation.test.cjs
npx tsc --noEmit --pretty false
```

Os testes substituem as fronteiras Android. No aparelho, validar:

- Criar dois grupos com notas diferentes e adicionar um widget de cada grupo.
- Cancelar a confirmação e tentar adicionar outro grupo.
- Confirmar uma solicitação depois de trocar de tela no app.
- Reiniciar o app/celular e conferir a associação de cada widget.
- Usar o botão “+” e abrir notas do widget, conferindo o retorno à home.
- Reconfigurar, redimensionar e remover um widget sem afetar o outro.
- Excluir um grupo e confirmar que o widget não passa a mostrar outro grupo.
