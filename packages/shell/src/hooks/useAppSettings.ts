import { useState } from "react";
import { useToastMutation } from "./useToastMutation";
import { type AppSetting, useAppSettingsData } from "./useAppSettingsData";
import { useSettingDraft } from "./useSettingDraft";

// The wire type is declared once in @groot/core (type-only import, erased at
// build); re-exported under the name clients already import.
export type { AppSetting };

/**
 * @deprecated Data and editor state in one hook. Use `useAppSettingsData()`
 * (`@groot/shell/hooks/useAppSettingsData`) for the settings and the calls
 * that change them, and `useSettingDraft(setting)` for an editor's draft;
 * `AppSettings` shows how they compose. Kept with its old shape for existing
 * callers, on top of those two: creating refuses an existing key, and a
 * refetch no longer replaces unsaved edits.
 */
export function useAppSettings() {
  const data = useAppSettingsData();
  const { settings } = data;

  const [userSelectedKey, setUserSelectedKey] = useState<string | null>(null);
  const [showNewSettingForm, setShowNewSettingForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSettings = settings.filter((setting) =>
    setting.key.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Selection: the user's explicit choice, else the first setting once loaded.
  const selectedKey = userSelectedKey ?? settings[0]?.key ?? null;
  const selected = selectedKey ? data.get(selectedKey) : null;
  const draft = useSettingDraft(selected);

  const saveMutation = useToastMutation(
    (vars: { key: string; value: () => unknown; description: string }) =>
      data.save(vars.key, vars.value(), vars.description || undefined),
    {
      success: (saved) => `"${saved.key}" updated successfully`,
      error: { title: "Save failed", description: "Unable to update setting" },
    },
  );

  const deleteMutation = useToastMutation((key: string) => data.remove(key), {
    success: "Setting deleted successfully",
    error: { title: "Delete failed", description: "Unable to delete setting" },
  });

  const createMutation = useToastMutation((key: string) => data.create(key, {}, "New setting"), {
    success: (created) => `"${created.key}" created successfully`,
    error: { title: "Create failed", description: "Unable to create setting" },
  });

  const save = () => {
    if (!selectedKey) return;
    saveMutation.mutate({ key: selectedKey, value: draft.parse, description: draft.description });
  };

  const confirmDelete = () => {
    if (!selectedKey) return;
    deleteMutation.mutate(selectedKey, {
      onSuccess: () => setUserSelectedKey(null),
    });
  };

  const createSetting = (key: string) => {
    const trimmed = key.trim();
    if (!trimmed) return;
    createMutation.mutate(trimmed, {
      onSuccess: () => {
        setUserSelectedKey(trimmed);
        setShowNewSettingForm(false);
      },
    });
  };

  return {
    settings,
    isLoading: data.isLoading,
    filteredSettings,
    selectedKey,
    selected,
    selectKey: setUserSelectedKey,
    searchQuery,
    setSearchQuery,
    jsonValue: draft.jsonValue,
    setJsonValue: draft.setJsonValue,
    description: draft.description,
    setDescription: draft.setDescription,
    showNewSettingForm,
    setShowNewSettingForm,
    refresh: data.refresh,
    isSaving: saveMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isCreating: createMutation.isPending,
    save,
    confirmDelete,
    createSetting,
  };
}
