import type { Spec } from "./NativeFeedbackBee";

declare const require: (id: string) => { default: Spec | null };

/** Wire values from the upload contract. */
export type FeedbackKind = "issue" | "feature_request" | "other";

export interface InitOptions {
  /** The project id from your FeedbackBee dashboard. */
  projectId: string;
  /** Base URL of your FeedbackBee website or Worker, including `https://`. There is no default server. */
  endpoint: string;
  /** Shake to open the sheet. Defaults to `true`. */
  shake?: boolean;
}

export interface OpenOptions {
  /** Preselected feedback type. Omitted, the user picks one, as after a shake. */
  kind?: FeedbackKind;
  /** Hides the type picker and its Back control: for a dedicated "Report a problem" button. */
  lockKind?: boolean;
  /** Prefilled note; the user can edit it. */
  text?: string;
}

export interface Reporter {
  email?: string | null;
  name?: string | null;
  /** Your user id. */
  id?: string | null;
}

/** `null` or `undefined` removes the key. */
export type ContextValue = string | number | boolean | null | undefined;

let nativeModule: Spec | null | undefined;
let warnedMissing = false;

/** Looked up on first call, not at import, so importing the package costs nothing at app launch. */
function native(): Spec | null {
  if (nativeModule === undefined) nativeModule = require("./NativeFeedbackBee").default;
  if (!nativeModule && !warnedMissing) {
    warnedMissing = true;
    console.warn(
      "FeedbackBee: the native module is not linked, so feedback calls do nothing. " +
        "Rebuild the app after installing react-native-feedbackbee (Expo Go is not supported; use a development build).",
    );
  }
  return nativeModule;
}

export const FeedbackBee = {
  /**
   * Starts FeedbackBee. Call it once at startup; calling it again replaces the previous setup.
   * Throws for a blank project id or an endpoint that is not an http(s) base URL.
   */
  init({ projectId, endpoint, shake = true }: InitOptions): void {
    const error = native()?.configure(projectId, endpoint, shake);
    if (error) throw new Error(error);
  },

  /** Opens the native feedback sheet. Does nothing while one is already open. */
  open({ kind, lockKind = false, text = "" }: OpenOptions = {}): void {
    native()?.open(kind ?? null, lockKind, text);
  },

  /** Reporter details shown in your dashboard (never on the GitHub issue). Sticky until `reset()`. */
  identify({ email = null, name = null, id = null }: Reporter): void {
    native()?.identify(email, name, id);
  },

  /** Extra key/value context for every report, merged into what was set before. Dashboard-only. */
  setContext(context: Record<string, ContextValue>): void {
    const values: { [key: string]: string | number | boolean | null } = {};
    for (const key of Object.keys(context)) values[key] = context[key] ?? null;
    native()?.setContext(values);
  },

  /** Clears `identify` and `setContext`, e.g. on logout. */
  reset(): void {
    native()?.reset();
  },
};

export default FeedbackBee;
