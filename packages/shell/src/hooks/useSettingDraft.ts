import { useState } from "react";
import type { AppSetting } from "@groot/core/settings/app-settings.schema";

interface Snapshot {
  json: string;
  description: string;
}

interface DraftState {
  key: string | null;
  /** The server values the draft started from. */
  base: Snapshot;
  draft: Snapshot;
}

const snapshotOf = (setting: AppSetting | null): Snapshot => ({
  json: setting ? JSON.stringify(setting.value, null, 2) : "",
  description: setting?.metadata?.description ?? "",
});

/** Equal as JSON values when both parse (formatting aside), else as text. */
function sameJson(a: string, b: string): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b));
  } catch {
    return false;
  }
}

const same = (a: Snapshot, b: Snapshot) =>
  a.description === b.description && sameJson(a.json, b.json);

const fresh = (key: string | null, server: Snapshot): DraftState => ({
  key,
  base: server,
  draft: server,
});

/**
 * The editable draft of one setting: its JSON text and description, and
 * whether they differ from what the server had when editing began.
 *
 * - Selecting another setting starts a fresh draft.
 * - A refetch that brings a new server value updates a clean draft and leaves
 *   a dirty one alone (`serverChanged` then says the server moved under it).
 * - A draft the server catches up with (after a save) is clean again.
 */
export function useSettingDraft(setting: AppSetting | null) {
  const key = setting?.key ?? null;
  const server = snapshotOf(setting);
  const [state, setState] = useState<DraftState>(() => fresh(key, server));

  const isDirty = !same(state.draft, state.base);
  let next: DraftState | null = null;
  if (state.key !== key) {
    next = fresh(key, server);
  } else if (!same(state.base, server)) {
    // Clean: follow the server. Dirty but equal to the server: it was saved.
    if (!isDirty || same(state.draft, server)) next = fresh(key, server);
  }
  if (next) setState(next);
  const current = next ?? state;

  const setJsonValue = (json: string) => setState((s) => ({ ...s, draft: { ...s.draft, json } }));
  const setDescription = (description: string) =>
    setState((s) => ({ ...s, draft: { ...s.draft, description } }));

  return {
    jsonValue: current.draft.json,
    setJsonValue,
    description: current.draft.description,
    setDescription,
    /** The draft differs from the server value it started from. */
    isDirty: !same(current.draft, current.base),
    /** The draft is dirty and the server value changed since editing began. */
    serverChanged: !same(current.base, server),
    /** Throw away the draft and take the server's current value. */
    discard: () => setState(fresh(key, server)),
    /** The draft's JSON, parsed. Throws `Error("Invalid JSON format")` when it does not parse. */
    parse: (): unknown => {
      try {
        return JSON.parse(current.draft.json);
      } catch {
        throw new Error("Invalid JSON format");
      }
    },
  };
}
