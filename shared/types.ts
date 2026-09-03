export type ExtractedScope = {
  repo: string | null;
  branchName: string | null;
};

export type ObjectiveKind = "objective" | "target";

export type ObjectiveItemStatus = "not-started" | "in-progress" | "met";

export type ObjectiveItem = {
  id: string;
  text: string;
  status: ObjectiveItemStatus;
};

export type DraftedSet = {
  id: string;
  kind: ObjectiveKind;
  title: string;
  repo: string | null;
  branchName: string | null;
  items: ObjectiveItem[];
  createdAt: string;
};

export type GenerateResponse = {
  title: string;
  items: string[];
  repo: string | null;
  branchName: string | null;
};
