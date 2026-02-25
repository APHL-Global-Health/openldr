import { ContentLayout } from "@/components/admin-panel/content-layout";
import { ChatMain } from "@/components/chat/chat-main";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { GridPattern } from "@/components/grid-pattern";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ModelSelector } from "@/components/chat/chat-model-selector";

function ChatPage() {
  const [resetKey, setResetKey] = useState(0);

  const handleNewChat = () => {
    setResetKey((prev) => prev + 1);
  };

  const navComponents = () => {
    return (
      <div className="flex min-h-13 max-h-13 w-full items-center px-2 py-2">
        Chats
        {/* <div className="flex flex-1 min-h-13 max-h-13">hi</div> */}
        {/* <ModelSelector className="w-full max-w-sm" /> */}
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
        <div className="flex w-full h-full flex-row overflow-auto min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)]">
          <div className="flex flex-col min-w-64 max-w-64 min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] ">
            <ChatSidebar onReset={handleNewChat} />
          </div>

          <div className="flex flex-1 w-full min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)]border-l border-border overflow-hidden relative">
            <GridPattern className="pointer-events-none" />

            <div className="relative z-10 h-full w-full">
              <ChatMain resetKey={resetKey} />
            </div>
          </div>
        </div>
      </div>
    </ContentLayout>
  );
}

export default ChatPage;
