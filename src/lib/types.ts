export type TitleSource = "user" | "ai";
export type DraftStatus = "brewing" | "completed" | "failed";
export type DraftVersionSource = "ai" | "ai_revision" | "manual_edit";
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
  }>;
  snapshottedAt: string;
};

export type SchemeDraftSnapshot = {
  type: "scheme";
  version: 1;
  content: SchemeSnapshot;
};

export type RevisionSnapshotContent = {
  sourceVersionId: string;
  sourceVersionNo: number;
  sourceContent: string;
  instruction: string;
  schemeSnapshot: SchemeSnapshot;
  snapshottedAt: string;
};

export type RevisionDraftSnapshot = {
  type: "revision";
  version: 1;
  content: RevisionSnapshotContent;
};

export type DraftVersionSnapshot = SchemeDraftSnapshot | RevisionDraftSnapshot;

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
  snapshot: DraftVersionSnapshot;
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
