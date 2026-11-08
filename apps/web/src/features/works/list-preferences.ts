'use client';
import { create } from 'zustand';
type Filter = 'all' | 'draft' | 'confirmed';
export const useListPreferences = create<{
  search: string;
  filter: Filter;
  setSearch: (search: string) => void;
  setFilter: (filter: Filter) => void;
}>((set) => ({
  search: '',
  filter: 'all',
  setSearch: (search) => {
    set({ search });
  },
  setFilter: (filter) => {
    set({ filter });
  },
}));
