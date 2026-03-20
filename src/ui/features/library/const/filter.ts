export type LibraryFilter = {
  search: string;
  minRating: number;
  tags: string[];
  dateRange: { from: number; to: number } | null;
};

export const DEFAULT_FILTER: LibraryFilter = {
  search: '',
  minRating: 0,
  tags: [],
  dateRange: null,
};
