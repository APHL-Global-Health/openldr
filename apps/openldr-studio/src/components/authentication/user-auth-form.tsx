import * as React from "react";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import { useMultiNamespaceTranslation } from "@/i18n/hooks";

export function UserAuthForm({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const [isLoading, setLoading] = React.useState<boolean>(false);

  const client = useKeycloakClient();
  const { t } = useMultiNamespaceTranslation(["common", "app"]);

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <div className="grid gap-2">
        <Button
          disabled={isLoading}
          onClick={() => {
            if (client && !client.kc.authenticated) {
              setLoading(true);

              client.kc.login();

              setLoading(false);
            }
          }}
          className="mt-1 rounded-xs"
        >
          {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
          {t("app:authentication.login")}
        </Button>
      </div>
    </div>
  );
}
