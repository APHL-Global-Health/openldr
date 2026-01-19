import LogoutOptions from "@/components/logout-options";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import useWindowSize from "@/hooks/misc/useWindowSize";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { SettingsAppearance } from "./apperance";
import { SettingsGeneral } from "./general";
// import { SettingsDatabase } from "./database";
// import { SettingsStorage } from "./storage";
// import { ServicesDatabase } from "./services";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import { LanguageSwitcher } from "@/components/language-switcher";

type Page = {
  id: string;
  name: string;
  selected: string;
};

function SettingsPage() {
  const client = useKeycloakClient();
  const keycloak = client.kc;
  const hasPriviledges = keycloak.hasRealmRole(
    import.meta.env.VITE_PRIVILEDGED_ROLE || "user"
  );

  let links: any = [
    { id: "6c84fb90-12c4-11e1-840d-7b25c5ee775a", name: "General" },
    { id: "110e8400-e29b-11d4-a716-446655440000", name: "Appearance" },
  ];

  if (hasPriviledges) {
    links = [
      { id: "6c84fb90-12c4-11e1-840d-7b25c5ee775a", name: "General" },
      { id: "110e8400-e29b-11d4-a716-446655440000", name: "Appearance" },
      // { id: "3e7c3f6d-bdf5-46ae-8d90-171300f27ae2", name: "Services" },
      // { id: "3e7c3f6d-bdf5-46ae-8d90-171300f27ae2", name: "Database" },
      // { id: "8f7b5db9-d935-4e42-8e05-1f1d0a3dfb97", name: "Storage" },
      // { id: "61c35085-72d7-42b4-8d62-738f700d4b92", name: "API" },
      // { id: "1f0f2c02-e299-40de-9b1d-86ef9e42126b", name: "Authentication" },
    ];
  }

  const defualtPage = links[0];

  const windowSize = useWindowSize();
  const [page, setPage] = useState<Page | undefined>({
    ...defualtPage,
    selected: defualtPage.id,
  });

  return (
    <div className="flex w-full h-full flex-row">
      <div className="flex flex-1 flex-row">
        <div className="flex w-48 flex-col">
          <div className="flex min-h-13 max-h-13 w-full items-center px-2 py-2"></div>
          <Separator />
          <div
            className="flex flex-1 flex-col w-full h-full overflow-y-auto"
            style={{ maxHeight: `${windowSize.height - 53}px` }}
          >
            <ScrollArea className="h-screen p-2 flex flex-col gap-2">
              {links.map((item: Page, index: number) => (
                <Button
                  key={index}
                  variant="ghost"
                  onClick={() =>
                    setPage({
                      ...item,
                      selected: item.id,
                    })
                  }
                  className={cn(
                    buttonVariants({
                      variant:
                        page && page?.selected === item.id
                          ? "default"
                          : "ghost",
                      size: "icon",
                    }),
                    "w-full mb-2 text-xs justify-between rounded-sm",
                    page &&
                      page?.selected === item.id &&
                      "hover:text-white dark:bg-muted dark:text-primary dark:hover:bg-muted dark:hover:text-primary"
                  )}
                >
                  {item.name}
                  <ArrowRight
                    className="-me-1 ms-2 opacity-60 transition-transform group-hover:translate-x-0.5"
                    size={16}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </Button>
              ))}
            </ScrollArea>
          </div>
        </div>
        <Separator orientation="vertical" />
        <div className="flex flex-1 flex-col">
          <div className="flex min-h-13 max-h-13 w-full items-center px-2 py-2">
            <div className="flex flex-1"></div>
            <Separator orientation="vertical" className="mx-2 h-6" />
            <LanguageSwitcher />
            <Separator orientation="vertical" className="mx-2 h-6" />
            <LogoutOptions />
          </div>
          <Separator />
          <div
            className="flex w-full h-full"
            style={{ maxHeight: `${windowSize.height - 53}px` }}
          >
            {page?.name === "General" && <SettingsGeneral />}
            {page?.name === "Appearance" && <SettingsAppearance />}
            {/* {page?.name === "Services" && <ServicesDatabase />} */}
            {/* {page?.name === "Database" && <SettingsDatabase />}
            {page?.name === "Storage" && <SettingsStorage />} */}
            {/* {page?.name === "API" && page?.name}
            {page?.name === "Authentication" && page?.name} */}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
