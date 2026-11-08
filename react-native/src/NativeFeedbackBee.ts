import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

/**
 * The native surface, kept to a handful of scalar calls so each one is a single JSI call with no
 * serialization beyond its arguments. The sheet, capture, recording and upload all run natively.
 */
export interface Spec extends TurboModule {
  /** Validates synchronously and returns the problem, or null once configured. */
  configure(projectId: string, endpoint: string, shake: boolean): string | null;
  open(kind: string | null, lockKind: boolean, text: string): void;
  identify(email: string | null, name: string | null, reporterId: string | null): void;
  setContext(context: { [key: string]: string | number | boolean | null }): void;
  reset(): void;
}

// `get`, not `getEnforcing`: Expo Go and web have no native module, and the JS API degrades to no-ops there.
export default TurboModuleRegistry.get<Spec>("FeedbackBee");
