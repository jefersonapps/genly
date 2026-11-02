import { create } from 'zustand';

type LibraryGroup = { id: number; name: string };

export const useLibraryStore = create<{
  selectedGroupId: number | null;
  groups: LibraryGroup[];
  selectGroup: (id: number | null) => void;
  syncGroups: (groups: LibraryGroup[]) => void;
}>((set) => ({
  selectedGroupId: null,
  groups: [],
  selectGroup: (selectedGroupId) => set({ selectedGroupId }),
  syncGroups: (groups) => set(state => ({
    groups,
    selectedGroupId: groups.some(group => group.id === state.selectedGroupId)
      ? state.selectedGroupId : null,
  })),
}));
