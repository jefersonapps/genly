export function updateErrorMessage(error: unknown, operation: 'check' | 'download' | 'install'): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/network|fetch failed|failed to fetch|load failed|offline|unknownhost|unable to resolve|failed to connect|connection|socket|timed?\s*out|timeout|ENOTFOUND|ECONN|ENETUNREACH|EAI_AGAIN/i.test(message)) {
    return 'A conexão falhou. Verifique o sinal de internet ou sua rede Wi-Fi e tente novamente.';
  }
  if (operation === 'check') return 'Não foi possível verificar as atualizações agora. Tente novamente em instantes.';
  if (operation === 'install') return 'Não foi possível abrir o instalador. Tente novamente e verifique a permissão para instalar aplicativos.';
  return 'Não foi possível baixar a atualização. Verifique o espaço disponível e tente novamente.';
}
