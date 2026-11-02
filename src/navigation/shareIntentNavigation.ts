import type { ShareIntent } from 'expo-share-intent';

export type ShareDestination = { pathname: string; params: Record<string, string> };
export function shareRequestId(share: ShareIntent): string {
  return share.meta?.shareId || JSON.stringify([share.type, share.meta?.component, share.text, share.webUrl, share.files]);
}
export function shareDestination(share: ShareIntent): ShareDestination {
  const id = shareRequestId(share);
  const params = { shareRequestId: id };
  const first = share.files?.[0];
  const component = share.meta?.component || '';
  const target = (suffix: string) => component.endsWith(`.${suffix}Activity`);
  const fileType = first?.mimeType?.toLowerCase();
  const path = first?.path?.toLowerCase() || '';
  if (first && (target('ImportBackup') || fileType === 'application/json' || fileType === 'application/zip' || /\.(json|zip)$/.test(path))) {
    return { pathname: '/backup/confirm-backup', params: { ...params, fileUri: first.path } };
  }
  if (share.type === 'text' || share.type === 'weburl') {
    const text = share.text || share.webUrl;
    if (!text) throw new Error('O compartilhamento não contém texto.');
    return { pathname: '/task/editor', params: { ...params, sharedText: text } };
  }
  const uris = share.files?.map(file => file.path).filter((uri): uri is string => !!uri) || [];
  if (!uris.length) throw new Error('O compartilhamento não contém arquivos acessíveis.');
  const imageUris = JSON.stringify(uris);
  if (target('CreatePdf')) return { pathname: '/tools/pdf-organizer', params: { ...params, imageUris } };
  if (target('Scanner')) return { pathname: '/tools/document-scanner', params: { ...params, imageUris } };
  if (target('ConvertPdf')) return { pathname: '/tools/pdf-to-image', params: { ...params, fileUri: uris[0] } };
  if (target('Ocr')) return { pathname: '/tools/ocr-tool', params: { ...params, imageUri: uris[0] } };
  if (target('QrReader')) return { pathname: '/tools/qr-tool', params: { ...params, imageUri: uris[0], mode: 'read' } };
  if (target('ColorPicker')) return { pathname: '/tools/color-picker', params: { ...params, sharedUri: uris[0] } };
  if (target('BackgroundRemover')) return { pathname: '/tools/background-remover', params: { ...params, sharedUri: uris[0] } };
  if (target('EditPdf') || fileType === 'application/pdf' || path.endsWith('.pdf')) return { pathname: '/tools/pdf-editor', params: { ...params, sharedUri: uris[0] } };
  return { pathname: '/task/editor', params: { ...params, sharedImages: imageUris } };
}

/** A request is consumed only when its receipt appears in the active route. */
export class ShareDelivery {
  pendingId: string | null = null;
  private acknowledgedId: string | null = null;
  private receivedNativeIds = new Set<string>();
  hasReceived(id: string): boolean { return this.acknowledgedId === id || this.receivedNativeIds.has(id); }
  begin(id: string, ready: boolean): boolean {
    if (!ready || this.pendingId || this.hasReceived(id)) return false;
    this.pendingId = id;
    return true;
  }
  receive(id?: unknown): boolean {
    if (!this.pendingId || id !== this.pendingId) return false;
    this.acknowledgedId = this.pendingId;
    // Native IDs identify events, unlike the payload fingerprint used by older/iOS clients.
    if (!this.pendingId.startsWith('[')) {
      this.receivedNativeIds.add(this.pendingId);
      if (this.receivedNativeIds.size > 64) this.receivedNativeIds.delete(this.receivedNativeIds.values().next().value!);
    }
    this.pendingId = null;
    return true;
  }
  retry() { this.pendingId = null; }
  empty() { if (!this.pendingId) this.acknowledgedId = null; }
}
