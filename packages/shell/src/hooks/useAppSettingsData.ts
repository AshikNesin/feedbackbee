import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@groot/shell/lib/api";
// Wire type from the zod-only schema leaf; the service module's graph is
// server-side (logger, kv) and must not enter the client type graph.
import type { AppSetting } from "@groot/core/settings/app-settings.schema";

export type { AppSetting };

/** The React Query key of the settings list. */
export const APP_SETTINGS_KEY = ["app-settings"] as const;

const settingPath = (key: string) => `/settings/${encodeURIComponent(key)}`;

/**
 * The app settings (`/api/v1/settings`) as data: the list and the calls that
 * change it. Each call refreshes the list before it resolves and rejects on
 * failure, so wrap it in `useAction` (`@groot/shell/lib/feedback`) for
 * toasts. Editor state (selection, drafts) is not here; see
 * `useSettingDraft`.
 */
export function useAppSettingsData() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: APP_SETTINGS_KEY,
    queryFn: () => apiClient.get<AppSetting[]>("/settings"),
  });
  const settings = query.data ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: APP_SETTINGS_KEY });

  /** The setting stored under `key`, or null. */
  const get = (key: string): AppSetting | null => settings.find((s) => s.key === key) ?? null;

  /** Write `value` (and the description) under `key`, creating or overwriting it. */
  const save = async (key: string, value: unknown, description?: string): Promise<AppSetting> => {
    const saved = await apiClient.put<AppSetting>(settingPath(key), {
      value,
      metadata: { description },
    });
    await refresh();
    return saved;
  };

  /**
   * Create a setting under a new key. Refuses a key the list already holds
   * without a request, and the server refuses (409) one it holds that the
   * list has not caught up with, so creating never overwrites a value.
   */
  const create = async (
    key: string,
    value: unknown = {},
    description?: string,
  ): Promise<AppSetting> => {
    const trimmed = key.trim();
    if (!trimmed) throw new Error("Key is required");
    const known = queryClient.getQueryData<AppSetting[]>(APP_SETTINGS_KEY) ?? settings;
    if (known.some((s) => s.key === trimmed)) {
      throw new Error(`A setting named “${trimmed}” already exists.`);
    }
    const created = await apiClient.post<AppSetting>("/settings", {
      key: trimmed,
      value,
      metadata: { description },
    });
    await refresh();
    return created;
  };

  /** Delete the setting under `key`. */
  const remove = async (key: string): Promise<void> => {
    await apiClient.delete(settingPath(key));
    await refresh();
  };

  return {
    settings,
    isLoading: query.isLoading,
    isError: query.isError,
    refresh,
    get,
    save,
    create,
    remove,
  };
}
