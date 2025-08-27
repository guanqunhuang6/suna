export interface ContentItem {
  id: string;
  url: string;
  metadata?: {
    title?: string;
    description?: string;
    thumbnail?: string;
  };
}

export interface ContentQueueState {
  contentQueue: ContentItem[];
  currentIndex: number;
  isLoading: boolean;
  isFetchingMore: boolean;
  preloadThreshold: number;
  preloadCount: number;
  navigateNext: () => void;
  navigatePrevious: () => void;
  fetchMoreContent: () => Promise<void>;
  initializeContent: () => Promise<void>;
  reset: () => void;
}

export interface ContentFeedResponse {
  contents: ContentItem[];
  nextCursor?: string;
}