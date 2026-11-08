import { useEffect, useState } from "react";
import { apiClient } from "@groot/shell/lib/api";
import type { SetupStatus } from "@groot/core/auth/auth.schema";

/**
 * Whether the first account still needs creating (`GET /auth/setup`):
 * `undefined` while loading, then `true` or `false`. A failed request reads
 * as `false`, so sign-in stays reachable when the server is unhappy.
 */
export function useSetupStatus(): boolean | undefined {
  const [needsSetup, setNeedsSetup] = useState<boolean>();

  useEffect(() => {
    let live = true;
    apiClient.get<SetupStatus>("/auth/setup").then(
      (status) => live && setNeedsSetup(status.needsSetup),
      () => live && setNeedsSetup(false),
    );
    return () => {
      live = false;
    };
  }, []);

  return needsSetup;
}
