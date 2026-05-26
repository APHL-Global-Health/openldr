"use client";

import { useState } from "react";
import {
  SearchIcon,
  HomeIcon,
  SparklesIcon,
  FileStackIcon,
  Layers3Icon,
  FolderClosedIcon,
  ZapIcon,
  MessageCircleDashedIcon,
  WandSparklesIcon,
  BoxIcon,
  ChevronDownIcon,
  UsersIcon,
  BriefcaseIcon,
  GraduationCapIcon,
  CheckIcon,
  MoreVerticalIcon,
  Share2Icon,
  PencilIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  Trash2Icon,
  PlusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useChatStore } from "@/store/chat-store";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const ENV = import.meta.env;
const baseUrl = ENV.VITE_BASE_URL || "/";

const iconMap = {
  zap: ZapIcon,
  "message-circle-dashed": MessageCircleDashedIcon,
  "wand-sparkles": WandSparklesIcon,
  box: BoxIcon,
};

const teams = [
  { id: "personal", name: "Personal", icon: UsersIcon },
  { id: "work", name: "Work Team", icon: BriefcaseIcon },
  { id: "education", name: "Education", icon: GraduationCapIcon },
];

interface ChatSideViewProps {
  onReset: () => void;
}

export function ChatSidebar({ onReset }: ChatSideViewProps) {
  const {
    chats,
    selectedChatId,
    selectChat,
    archiveChat,
    unarchiveChat,
    deleteChat,
    createNewChat,
  } = useChatStore();
  const [selectedTeam, setSelectedTeam] = useState("personal");

  const recentChats = chats.filter((chat) => !chat.isArchived);
  const archivedChats = chats.filter((chat) => chat.isArchived);

  return (
    <div className="flex h-full w-full flex-col bg-sidebar border-r border-sidebar-border">
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
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 px-2"
          onClick={onReset}
        >
          <PlusCircle className="size-4" />
          <span className="text-sm">New chat</span>
        </Button>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="p-3 space-y-4">
          <div className="space-y-1">
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Recent
              </p>
            </div>
            {recentChats.map((chat) => {
              const Icon =
                iconMap[chat.icon as keyof typeof iconMap] ||
                MessageCircleDashedIcon;
              const isActive = selectedChatId === chat.id;
              return (
                <div
                  key={chat.id}
                  className={cn(
                    "group/item relative flex items-center rounded-md overflow-hidden",
                    isActive && "bg-sidebar-accent",
                  )}
                >
                  <Button
                    variant="ghost"
                    className={cn(
                      "flex-1 justify-start gap-2 px-2 text-left h-auto py-1.5 min-w-0 pr-8",
                      isActive ? "hover:bg-sidebar-accent" : "hover:bg-accent",
                    )}
                    onClick={() => selectChat(chat.id)}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="text-sm truncate min-w-0">
                      {chat.title}
                    </span>
                  </Button>
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
                    <DropdownMenuContent
                      className="w-48"
                      side="right"
                      align="start"
                    >
                      <DropdownMenuItem>
                        <Share2Icon className="size-4 text-muted-foreground" />
                        <span>Share</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <PencilIcon className="size-4 text-muted-foreground" />
                        <span>Rename</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => archiveChat(chat.id)}>
                        <ArchiveIcon className="size-4 text-muted-foreground" />
                        <span>Archive</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => deleteChat(chat.id)}
                      >
                        <Trash2Icon className="size-4" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>

          <div className="space-y-1">
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Archived
              </p>
            </div>
            {archivedChats.map((chat) => {
              const Icon =
                iconMap[chat.icon as keyof typeof iconMap] ||
                MessageCircleDashedIcon;
              const isActive = selectedChatId === chat.id;
              return (
                <div
                  key={chat.id}
                  className={cn(
                    "group/item relative flex items-center rounded-md overflow-hidden",
                    isActive && "bg-sidebar-accent",
                  )}
                >
                  <Button
                    variant="ghost"
                    className={cn(
                      "flex-1 justify-start gap-2 px-2 text-left h-auto py-1.5 min-w-0 pr-8",
                      isActive ? "hover:bg-sidebar-accent" : "hover:bg-accent",
                    )}
                    onClick={() => selectChat(chat.id)}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="text-sm truncate min-w-0">
                      {chat.title}
                    </span>
                  </Button>
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
                    <DropdownMenuContent
                      className="w-48"
                      side="right"
                      align="start"
                    >
                      <DropdownMenuItem>
                        <Share2Icon className="size-4 text-muted-foreground" />
                        <span>Share</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <PencilIcon className="size-4 text-muted-foreground" />
                        <span>Rename</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => unarchiveChat(chat.id)}>
                        <ArchiveRestoreIcon className="size-4 text-muted-foreground" />
                        <span>Unarchive</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => deleteChat(chat.id)}
                      >
                        <Trash2Icon className="size-4" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
