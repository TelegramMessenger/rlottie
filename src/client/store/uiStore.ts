import { create } from 'zustand';

interface UiState {
  sidebarOpen: boolean;
  activeProjectId: string | null;
  setSidebarOpen: (v: boolean) => void;
  setActiveProject: (id: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  activeProjectId: null,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setActiveProject: (id) => set({ activeProjectId: id }),
}));
