import { NavLink } from "react-router-dom";
import { MenuIcon, PanelsTopLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Menu } from "@/components/admin-panel/menu";
import {
  Sheet,
  SheetHeader,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import logoImage from "@/assets/OpenODRv2Logo.png";

export function SheetMenu() {
  return (
    <Sheet>
      <SheetTrigger className="lg:hidden" asChild>
        <Button className="h-8" variant="outline" size="icon">
          <MenuIcon size={20} />
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:w-72 px-3 h-full flex flex-col" side="left">
        <SheetHeader>
          {/* <Button
            className="flex justify-center items-center pb-2 pt-1"
            variant="link"
            asChild
          >
            <NavLink to="/dashboard" className="flex items-center gap-2">
              <PanelsTopLeft className="w-6 h-6 mr-1" />
              <SheetTitle className="font-bold text-lg">Brand</SheetTitle>
            </NavLink>
          </Button> */}
          <div className="flex flex-row ml-2 cursor-default">
            <div className="w-5.5 overflow-hidden">
              <img
                src={logoImage}
                alt="openldr"
                className="h-6 object-cover object-left"
              />
            </div>
            <div className="ml-5 mt-0.5">OpenLDR</div>
          </div>
        </SheetHeader>
        <Menu isOpen />
      </SheetContent>
    </Sheet>
  );
}
