import { ContentLayout } from "@/components/admin-panel/content-layout";
import { ChatMain } from "@/components/chat/chat-main";
import { cn } from "@/lib/utils";
import { useAppTranslation } from "@/i18n/hooks";
import { ModelSelector } from "@/components/chat/chat-model-selector";
import { ModelLoadingIndicator } from "@/components/chat/chat-model-loading-indicator";
import { useModelStore } from "@/store/model-store";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ChevronDownIcon } from "lucide-react";

function ChatPage() {
  const { t } = useAppTranslation();
  const loadedModelId = useModelStore((s) => s.loadedModelId);
  const isLoadingModel = useModelStore((s) => s.isLoadingModel);
  const hasModel = !!loadedModelId && !isLoadingModel;
  const modelLabel = loadedModelId
    ? loadedModelId.split("/").pop()
    : "No model";

  const navComponents = () => {
    return (
      <div className="flex min-h-13 max-h-13 w-full items-center justify-between px-2 py-2">
        <span>{t("chats.title")}</span>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1.5 h-7 text-xs",
                !hasModel && "text-amber-500",
              )}
            >
              <span>{isLoadingModel ? "Loading..." : modelLabel}</span>
              <ChevronDownIcon className="size-3.5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle>AI Model</SheetTitle>
            </SheetHeader>
            <ModelLoadingIndicator />
            <ModelSelector />
          </SheetContent>
        </Sheet>
      </div>
    );
  };

  return (
    <ContentLayout nav={navComponents()}>
      <div
        className={cn(
          "flex flex-col min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] w-full h-full",
        )}
      >
        <div className="flex w-full h-full overflow-hidden min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)]">
          <ChatMain />
        </div>
      </div>
    </ContentLayout>
  );
}

export default ChatPage;
