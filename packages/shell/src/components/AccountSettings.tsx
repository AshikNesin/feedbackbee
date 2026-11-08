import { Card, CardContent } from "@groot/ui/card";
import { DataField, DataFields } from "@groot/ui/display";
import { Text, monoClass } from "@groot/ui/typography";
import { useAuthStore } from "@groot/shell/store/auth";

/** The signed-in user's profile, read-only. */
export function AccountSettings() {
  const user = useAuthStore((state) => state.user);
  if (!user) return null;

  const name = user.name?.trim();
  const initial = (name || user.email)[0]?.toUpperCase() ?? "?";

  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{name || user.email}</p>
          {name && (
            <Text variant="meta" className="block truncate">
              {user.email}
            </Text>
          )}
        </div>
      </CardContent>
      <CardContent className="border-t pt-4">
        <DataFields columns={3}>
          <DataField label="Name">
            {name || <span className="text-muted-foreground">Not set</span>}
          </DataField>
          <DataField label="Email" valueClassName="truncate">
            {user.email}
          </DataField>
          <DataField label="User ID" valueClassName={monoClass}>
            {user.id}
          </DataField>
        </DataFields>
      </CardContent>
    </Card>
  );
}
