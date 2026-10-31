/**
 * What the dashboard API sends, for the client to import type-only (dates
 * arrive as ISO strings). Erased at build: no server code reaches the bundle.
 * A leaf: it may import only the schema, never a service or route.
 */
import type { Feedback, Project } from "./db/schema";

export type { FeedbackKind, FeedbackState, LabelsMap } from "./db/schema";

type Wire<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] };

export type ProjectDTO = Wire<Project>;
export type FeedbackItemDTO = Wire<Feedback> & { images: string[] };
export type FeedbackPageDTO = { items: FeedbackItemDTO[]; hasMore: boolean };
