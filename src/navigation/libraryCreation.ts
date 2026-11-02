type LibraryGroup = { id: number; name: string };
let session = 0;

/** A new session also resets editors when the router reuses an existing screen. */
export function libraryCreationRoute(group?: LibraryGroup | null) {
  if (group?.name === 'Mapas Mentais') {
    return { pathname: '/tools/mind-map' as const, params: { groupId: String(group.id), mapSession: `${Date.now()}-${++session}` } };
  }
  if (group?.name === 'Flashcards') {
    return { pathname: '/tools/flashcards' as const, params: { groupId: String(group.id), createSession: `${Date.now()}-${++session}` } };
  }
  return group
    ? { pathname: '/task/editor' as const, params: { groupId: String(group.id) } }
    : { pathname: '/task/editor' as const };
}
