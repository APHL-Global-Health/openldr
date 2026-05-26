"use client";
import { Menu } from "@/components/admin-panel/menu";
import { SidebarToggle } from "@/components/admin-panel/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/hooks/use-sidebar";
import { useStore } from "@/hooks/use-store";
import { cn } from "@/lib/utils";
import logoImage from "@/assets/OpenODRv2Logo.png";

export function Sidebar() {
  const sidebar = useStore(useSidebar, (x) => x);
  if (!sidebar) return null;
  const { isOpen, toggleOpen, getOpenState, setIsHover, settings } = sidebar;
  return (
    <aside
      className={cn(
        "fixed top-0 left-0 z-20 h-screen -translate-x-full lg:translate-x-0 transition-[width] ease-in-out duration-300",
        !getOpenState() ? "w-22.5" : "w-72",
        settings.disabled && "hidden",
      )}
    >
      <SidebarToggle isOpen={isOpen} setIsOpen={toggleOpen} />
      <div
        onMouseEnter={() => setIsHover(true)}
        onMouseLeave={() => setIsHover(false)}
        className={cn(
          "relative h-full flex flex-col border-border border-r shadow-md dark:shadow-zinc-800",
        )}
      >
        <div className="sticky cursor-default top-0 z-10 w-full bg-background/95 shadow backdrop-blur supports-backdrop-filter:bg-background/60 dark:shadow-secondary">
          <div
            className={cn(
              "flex h-14 items-center ",
              isOpen ? "mx-8" : "justify-center",
            )}
          >
            {isOpen ? (
              <div className="flex flex-row">
                <div className="w-5.5 overflow-hidden">
                  <img
                    src={logoImage}
                    alt="openldr"
                    className="h-6 object-cover object-left logo"
                  />
                </div>
                <div className="ml-5 mt-0.5">OpenLDR</div>
              </div>
            ) : (
              <div className="w-5.5 overflow-hidden">
                <img
                  src={logoImage}
                  alt="openldr"
                  className="h-6 object-cover object-left logo"
                />
              </div>
            )}
          </div>
        </div>

        <div className="px-3 overflow-y-auto">
          <Menu isOpen={getOpenState()} />
        </div>
      </div>
    </aside>
  );
}
