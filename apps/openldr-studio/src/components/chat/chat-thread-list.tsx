import {
  ThreadListPrimitive,
  ThreadListItemPrimitive,
} from "@assistant-ui/react";
import {
  PlusCircle,
  MessageCircleDashedIcon,
  MoreVerticalIcon,
  Trash2Icon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  PencilIcon,
  SearchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { FC } from "react";

export const ChatThreadList: FC = () => {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="p-3">
        <div className="relative flex items-center">
          <SearchIcon className="absolute left-3 size-4 text-muted-foreground" />
          <Input
            placeholder="Search anything"
            className="pl-9 pr-10 h-8.5 bg-muted/50"
          />
          <div className="absolute right-2 flex items-center justify-center size-5 rounded bg-muted text-xs text-muted-foreground">
            /
          </div>
        </div>
      </div>

      <div className="px-3 pb-3 space-y-1">
        <ThreadListPrimitive.New asChild>
          <Button variant="ghost" className="w-full justify-start gap-2 px-2">
            <PlusCircle className="size-4" />
            <span className="text-sm">New chat</span>
          </Button>
        </ThreadListPrimitive.New>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="p-3 space-y-4">
          {/* Regular threads */}
          <div className="space-y-1">
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Recent
              </p>
            </div>
            <ThreadListPrimitive.Items
              components={{ ThreadListItem: RegularThreadItem }}
            />
          </div>

          {/* Archived threads */}
          <div className="space-y-1">
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Archived
              </p>
            </div>
            <ThreadListPrimitive.Items
              archived
              components={{ ThreadListItem: ArchivedThreadItem }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Regular thread item ─────────────────────────────────────────────────────

const RegularThreadItem: FC = () => {
  return (
    <ThreadListItemPrimitive.Root className="group/item relative flex items-center rounded-md overflow-hidden data-[active=true]:bg-sidebar-accent">
      <ThreadListItemPrimitive.Trigger className="flex-1 flex items-center gap-2 px-2 text-left h-auto py-1.5 min-w-0 pr-8 hover:bg-accent rounded-md data-[active=true]:hover:bg-sidebar-accent">
        <MessageCircleDashedIcon className="size-4 shrink-0" />
        <span className="text-sm truncate min-w-0">
          <ThreadListItemPrimitive.Title fallback="New chat" />
        </span>
      </ThreadListItemPrimitive.Trigger>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="icon-sm"
            className="absolute right-1 size-7 opacity-0 group-hover/item:opacity-100 data-[state=open]:opacity-100 transition-opacity"
          >
            <MoreVerticalIcon className="size-4" />
            <span className="sr-only">More</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48" side="right" align="start">
          <DropdownMenuItem>
            <PencilIcon className="size-4 text-muted-foreground" />
            <span>Rename</span>
          </DropdownMenuItem>
          <ThreadListItemPrimitive.Archive asChild>
            <DropdownMenuItem>
              <ArchiveIcon className="size-4 text-muted-foreground" />
              <span>Archive</span>
            </DropdownMenuItem>
          </ThreadListItemPrimitive.Archive>
          <DropdownMenuSeparator />
          <ThreadListItemPrimitive.Delete asChild>
            <DropdownMenuItem variant="destructive">
              <Trash2Icon className="size-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </ThreadListItemPrimitive.Delete>
        </DropdownMenuContent>
      </DropdownMenu>
    </ThreadListItemPrimitive.Root>
  );
};

// ── Archived thread item ────────────────────────────────────────────────────

const ArchivedThreadItem: FC = () => {
  return (
    <ThreadListItemPrimitive.Root className="group/item relative flex items-center rounded-md overflow-hidden data-[active=true]:bg-sidebar-accent">
      <ThreadListItemPrimitive.Trigger className="flex-1 flex items-center gap-2 px-2 text-left h-auto py-1.5 min-w-0 pr-8 hover:bg-accent rounded-md data-[active=true]:hover:bg-sidebar-accent">
        <MessageCircleDashedIcon className="size-4 shrink-0" />
        <span className="text-sm truncate min-w-0">
          <ThreadListItemPrimitive.Title fallback="New chat" />
        </span>
      </ThreadListItemPrimitive.Trigger>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="icon-sm"
            className="absolute right-1 size-7 opacity-0 group-hover/item:opacity-100 data-[state=open]:opacity-100 transition-opacity"
          >
            <MoreVerticalIcon className="size-4" />
            <span className="sr-only">More</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48" side="right" align="start">
          <DropdownMenuItem>
            <PencilIcon className="size-4 text-muted-foreground" />
            <span>Rename</span>
          </DropdownMenuItem>
          <ThreadListItemPrimitive.Unarchive asChild>
            <DropdownMenuItem>
              <ArchiveRestoreIcon className="size-4 text-muted-foreground" />
              <span>Unarchive</span>
            </DropdownMenuItem>
          </ThreadListItemPrimitive.Unarchive>
          <DropdownMenuSeparator />
          <ThreadListItemPrimitive.Delete asChild>
            <DropdownMenuItem variant="destructive">
              <Trash2Icon className="size-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </ThreadListItemPrimitive.Delete>
        </DropdownMenuContent>
      </DropdownMenu>
    </ThreadListItemPrimitive.Root>
  );
};
