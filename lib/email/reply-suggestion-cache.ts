import type { EmailThreadDetail, Viewer } from "@/lib/types";

import { generateReplySuggestions } from "./ai";

export async function getPersistedReplySuggestionsForThread(
  _viewer: Viewer,
  thread: EmailThreadDetail
) {
  return generateReplySuggestions(thread);
}
