import { useEffect, useRef } from 'react';

export function parseSharedPdfImages(value: string) {
  const uris: unknown = JSON.parse(value);
  if (!Array.isArray(uris) || !uris.length || !uris.every(uri => typeof uri === 'string' && uri.length > 0)) {
    throw new Error('Invalid shared image URIs');
  }
  return uris.map((uri: string, index: number) => ({
    id: `img-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    uniqueId: uri, sourceUri: uri, pageIndex: 0, sourceFileName: `Página ${index + 1}`,
    thumbnailUri: uri, rotation: 0, isImage: true,
  }));
}

export function useSharedPdfImages(imageUris: string | undefined, requestId: string | undefined,
  onImport: (pages: ReturnType<typeof parseSharedPdfImages>) => void, onError: (error: unknown) => void) {
  const importedRequest = useRef<string | null>(null);
  useEffect(() => {
    if (!imageUris) return;
    const request = requestId || imageUris;
    if (importedRequest.current === request) return;
    try {
      onImport(parseSharedPdfImages(imageUris));
      importedRequest.current = request;
    } catch (error) { onError(error); }
  }, [imageUris, requestId, onImport, onError]);
}
