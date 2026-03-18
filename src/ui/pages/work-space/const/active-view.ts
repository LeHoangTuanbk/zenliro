export const ActiveView = {
  Library: 'library',
  Develop: 'develop',
} as const;

export type ActiveView = (typeof ActiveView)[keyof typeof ActiveView];
