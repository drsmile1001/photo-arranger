export type ArrangePlan = {
  moves: Array<MoveFile>;
  deletes: string[];
};

export type MoveFile = { from: string; to: string };
