import { Boom } from "../errors";
import { logger } from "../logger";
import { createNamespaceKv } from "../kv";
import type { AppSetting, CreateAppSettingDTO, UpsertAppSettingDTO } from "./app-settings.schema";

const appSettingsKv = createNamespaceKv("APP_SETTING");

// Declared in the schema module (zod-only) so the client can import the wire
// type without dragging the service's server graph along.
export type { AppSetting, AppSettingMetadata } from "./app-settings.schema";

export async function get<T = unknown>({ key }: { key: string }): Promise<AppSetting<T>> {
  const setting = await appSettingsKv.get<AppSetting<T>>(key);
  if (!setting) {
    throw Boom.notFound(`App Setting '${key}' not found`);
  }
  return setting;
}

export async function getAll(): Promise<AppSetting[]> {
  const entries = await appSettingsKv.list<AppSetting>();
  return entries.map(({ key, value }) => ({ ...value, key }));
}

/** Create a setting. A key that already exists is a 409; `upsert` overwrites instead. */
export async function create<T = unknown>({
  data,
}: {
  data: CreateAppSettingDTO;
}): Promise<AppSetting<T>> {
  const { key, ...rest } = data;
  const setting = toSetting<T>(key, rest);
  if (!(await appSettingsKv.add(key, setting))) {
    throw Boom.conflict(`App Setting '${key}' already exists`);
  }
  logger.info({ key }, "App setting created");
  return setting;
}

function toSetting<T>(key: string, data: UpsertAppSettingDTO): AppSetting<T> {
  return {
    key,
    value: data.value as T,
    metadata: { ...data.metadata, updatedAt: new Date().toISOString() },
  };
}

export async function upsert<T = unknown>({
  key,
  data,
}: {
  key: string;
  data: UpsertAppSettingDTO;
}): Promise<AppSetting<T>> {
  const setting = toSetting<T>(key, data);
  await appSettingsKv.set(key, setting);
  logger.info({ key }, "App setting updated");
  return setting;
}

export async function deleteSetting({ key }: { key: string }): Promise<void> {
  const deleted = await appSettingsKv.delete(key);
  if (!deleted) {
    throw Boom.notFound(`App Setting '${key}' not found`);
  }
  logger.info({ key }, "App setting deleted");
}
