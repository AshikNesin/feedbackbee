import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@groot/shell/lib/api";
import { useAction } from "@groot/shell/lib/feedback";
import type { NotificationSettings, NotificationSettingsDTO } from "../../../server/wire-types";

const notificationSettingsKey = ["notifications", "settings"] as const;

export function useNotificationSettings() {
  return useQuery({
    queryKey: notificationSettingsKey,
    queryFn: () => apiClient.get<NotificationSettingsDTO>("/notifications"),
  });
}

export function useSaveNotificationSettings() {
  return useAction(
    (settings: NotificationSettings) =>
      apiClient.put<NotificationSettingsDTO>("/notifications", settings),
    {
      success: "Notification settings saved",
      errorTitle: "Couldn't save notification settings",
      fallback: "The settings were not saved. Try again.",
      invalidate: [notificationSettingsKey],
    },
  );
}

export function useTestNotification() {
  return useAction(() => apiClient.post<{ sent: true }>("/notifications/test"), {
    success: "Test notification sent",
    errorTitle: "Couldn't send the test notification",
    fallback: "Pushover didn't accept the notification.",
  });
}
