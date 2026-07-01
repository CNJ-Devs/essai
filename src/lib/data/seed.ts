import type { DemoState } from "@/lib/data/store-types";

export const DEMO_USER_ID = "user_demo";

export function createSeedState(): DemoState {
  const laws: DemoState["laws"] = [];
  const schemes: DemoState["schemes"] = [];
  const fragments: DemoState["fragments"] = [];
  const drafts: DemoState["drafts"] = [];

  return { fragments, schemes, laws, drafts };
}
