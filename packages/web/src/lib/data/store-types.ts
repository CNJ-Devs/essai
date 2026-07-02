import type { Draft, Fragment, Law, Scheme } from "@/lib/types";

export type DemoState = {
  fragments: Fragment[];
  schemes: Scheme[];
  laws: Law[];
  drafts: Draft[];
};
