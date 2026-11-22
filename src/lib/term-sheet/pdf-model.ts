export interface TsRun {
  s?: string;
  f?: string;
  p?: string;
  br?: number;
  b?: boolean;
  i?: boolean;
  u?: boolean;
}
export type TsParagraph = TsRun[];
export interface TsCell {
  h: boolean;
  p: TsParagraph[];
}
export type TsBlock =
  | { t: "p"; q: boolean; r: TsRun[] }
  | { t: "table"; w: number[]; rows: TsCell[][] };
