import { create } from 'zustand';
import type { ContentQueueState } from '@/types/content';

export const useContentQueueStore = create<ContentQueueState>()((set, get) => ({
  contentQueue: [],
  currentIndex: 0,
  isLoading: false,
  isFetchingMore: false,
  preloadThreshold: 2,
  preloadCount: 5,

  navigateNext: () => {
    const state = get();
    const nextIndex = state.currentIndex + 1;
    
    if (nextIndex < state.contentQueue.length) {
      set({ currentIndex: nextIndex });
      
      // Check if we need to fetch more content
      const remainingContent = state.contentQueue.length - nextIndex - 1;
      if (remainingContent < state.preloadThreshold && !state.isFetchingMore) {
        get().fetchMoreContent();
      }
    } else if (!state.isFetchingMore) {
      // If at the end, fetch more
      get().fetchMoreContent();
    }
  },

  navigatePrevious: () => {
    const state = get();
    const prevIndex = state.currentIndex - 1;
    
    if (prevIndex >= 0) {
      set({ currentIndex: prevIndex });
    }
  },

  fetchMoreContent: async () => {
    const state = get();
    if (state.isFetchingMore) return;

    set({ isFetchingMore: true });

    try {
      // Fetch all URLs from backend without filtering
      const response = await fetch('/api/content/feed');
      const data = await response.json();
      
      if (data.contents && data.contents.length > 0) {
        // Just append all contents without checking for duplicates
        set((state) => ({
          contentQueue: [...state.contentQueue, ...data.contents],
          isFetchingMore: false,
        }));
      } else {
        set({ isFetchingMore: false });
      }
    } catch (error) {
      console.error('Error fetching more content:', error);
      set({ isFetchingMore: false });
    }
  },

  initializeContent: async () => {
    const state = get();
    if (state.isLoading) return;

    set({ isLoading: true, contentQueue: [], currentIndex: 0 });

    try {
      // Fetch all available content URLs from backend
      const response = await fetch('/api/content/feed');
      const data = await response.json();
      
      if (data.contents && data.contents.length > 0) {
        set({
          contentQueue: data.contents,
          currentIndex: 0,
          isLoading: false,
        });
      } else {
        console.log('No content available from backend');
        set({
          contentQueue: [],
          currentIndex: 0,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('Error initializing content:', error);
      set({
        contentQueue: [],
        currentIndex: 0,
        isLoading: false,
      });
    }
  },

  reset: () => {
    set({
      contentQueue: [],
      currentIndex: 0,
      isLoading: false,
      isFetchingMore: false,
    });
  },
}));