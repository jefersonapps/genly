export function isNewerAppVersion(latest: string | undefined, current: string | undefined): boolean {
  if (!latest || !current) return false;
  const parse = (value: string) => /^v?\d+\.\d+\.\d+$/.test(value) ? value.replace(/^v/, '').split('.').map(Number) : null;
  const left = parse(latest);
  const right = parse(current);
  if (!left || !right) return false;
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] > right[i];
  }
  return false;
}

export function updateDownloadProgress(received: number, total: number, complete = false): number | null {
  if (complete) return 100;
  if (!Number.isFinite(received) || !Number.isFinite(total) || total <= 0) return null;
  // Only DownloadManager's successful status means the file is ready.
  return Math.max(0, Math.min(99, Math.floor(Math.max(0, received) / total * 100)));
}

export function updateDownloadFailure(reason: number): string {
  if (reason === 1006) return 'Não há espaço suficiente para baixar a atualização. Libere espaço e tente novamente.';
  if (reason === 1007) return 'O armazenamento está indisponível. Verifique o dispositivo e tente novamente.';
  return 'Não foi possível concluir o download. Verifique sua conexão e o espaço disponível e tente novamente.';
}

export function updateDownloadWaitingMessage(reason: number): string {
  if (reason === 3) return 'Aguardando uma conexão Wi-Fi para continuar.';
  if (reason === 2) return 'Aguardando conexão com a internet. O download continuará automaticamente.';
  return 'Aguardando o Android tentar novamente. O progresso será mantido quando possível.';
}

export function formatUpdateBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  return `${(bytes / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}
