export const ActiveTool = {
  Edit: 'edit',
  Heal: 'heal',
  Crop: 'crop',
} as const;

export type ActiveTool = (typeof ActiveTool)[keyof typeof ActiveTool];
