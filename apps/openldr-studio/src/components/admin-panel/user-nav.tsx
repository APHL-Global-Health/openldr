"use client";

import { NavLink } from "react-router-dom";
import { LayoutGrid, LogOut, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useKeycloakClient } from "../react-keycloak-provider";
import { useExtensions } from "@/hooks/misc/useExtensions";

const ENV = import.meta.env;
const baseUrl = ENV.VITE_BASE_URL || "/";

export function UserNav() {
  const client = useKeycloakClient();

  const token = client.kc?.tokenParsed;
  const user = token?.preferred_username || token?.email || "Guest";

  const ENV = import.meta.env;
  const baseUrl = ENV.VITE_BASE_URL || "/";

  const { state, dispatch, host } = useExtensions();

  async function onLogout() {
    if (client && state) {
      state.extensions
        .filter((e) => e.state === "active")
        .forEach((e) => host.deactivate(e.id));
      dispatch({ type: "DEACTIVATE_ALL" });
      dispatch({ type: "SET_ACTIVITY", payload: "extensions" });

      client.kc.logout({
        redirectUri: window.location.origin + baseUrl,
      });
    }
  }

  return (
    <DropdownMenu>
      <TooltipProvider disableHoverableContent>
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="relative h-8 w-8 rounded-full"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={`${baseUrl}img/avatar.jpg`} alt="@shadcn" />
                  <AvatarFallback className="bg-transparent">
                    {user}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Profile</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user}</p>
            {/* <p className="text-xs leading-none text-muted-foreground">{user}</p> */}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* <DropdownMenuGroup>
          <DropdownMenuItem className="hover:cursor-pointer" asChild>
            <NavLink to="/dashboard" className="flex items-center">
              <LayoutGrid className="w-4 h-4 mr-3 text-muted-foreground" />
              Dashboard
            </NavLink>
          </DropdownMenuItem>
          <DropdownMenuItem className="hover:cursor-pointer" asChild>
            <NavLink to="/account" className="flex items-center">
              <User className="w-4 h-4 mr-3 text-muted-foreground" />
              Account
            </NavLink>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator /> */}
        <DropdownMenuItem className="hover:cursor-pointer" onClick={onLogout}>
          <LogOut className="w-4 h-4 mr-3 text-muted-foreground" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
