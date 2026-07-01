export type TitleSource = "user" | "ai";
export type DraftStatus = "brewing" | "completed" | "failed";
export type DraftVersionSource = "ai" | "manual_edit";
export type Visibility = "private" | "public";

export type Law = {
  id: string;
  ownerUserId: string;
  name: string;
  prompt: string;
  tags: string[];
  visibility: Visibility;
  sourceLawId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type Scheme = {
  id: string;
  userId: string;
  name: string;
  description: string;
  lawIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type Fragment = {
  id: string;
  userId: string;
  title: string;
  titleSource: TitleSource;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type SchemeSnapshot = {
  schemeId: string;
  schemeName: string;
  schemeDescription: string;
  laws: Array<{
    lawId: string;
    name: string;
    prompt: string;
    version: number;
  }>;
  snapshottedAt: string;
};

export type DraftVersion = {
  id: string;
  draftId: string;
  versionNo: number;
  status: DraftStatus;
  source: DraftVersionSource;
  content: string;
  errorMessage: string | null;
  model: string | null;
  promptTemplateVersion: string;
  createdAt: string;
  updatedAt: string;
};

export type Draft = {
  id: string;
  fragmentId: string;
  schemeSnapshot: SchemeSnapshot;
  versions: DraftVersion[];
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceData = {
  fragments: Fragment[];
  schemes: Scheme[];
  laws: Law[];
  drafts: Draft[];
};

export type SchemeSelection = {
  schemeId: string;
  count: number;
};
