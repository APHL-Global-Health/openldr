import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useKeycloakClient } from "./react-keycloak-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const ENV = import.meta.env;
const baseUrl = ENV.VITE_BASE_URL || "/";

export function LogoutOptions() {
  const client = useKeycloakClient();

  const token = client.kc?.tokenParsed;
  const user = token?.preferred_username || token?.email || "Guest";

  const ENV = import.meta.env;
  const baseUrl = ENV.VITE_BASE_URL || "/";

  async function onLogout() {
    if (client) {
      client.kc.logout({
        redirectUri: window.location.origin + baseUrl,
      });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="w-6 h-6 mx-2 cursor-pointer border hover:border-primary">
          <AvatarImage src={`${baseUrl}/assets/avatar.jpg`} alt="@shadcn" />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-[14px] leading-none text-foreground-default">
              {user}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout}>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LogoutOptions;
