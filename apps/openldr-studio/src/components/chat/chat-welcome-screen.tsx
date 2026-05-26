import { ChatInputBox } from "./chat-input-box";
interface ChatWelcomeScreenProps {
  message: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
}

export function ChatWelcomeScreen({
  message,
  onMessageChange,
  onSend,
}: ChatWelcomeScreenProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 md:px-8">
      <div className="w-full max-w-160 space-y-9 -mt-12">
        <div className="space-y-4 text-center">
          <p className="text-2xl text-foreground">
            Tell me everything you need
          </p>
        </div>

        <ChatInputBox
          message={message}
          onMessageChange={onMessageChange}
          onSend={onSend}
          showTools={true}
        />
      </div>
    </div>
  );
}
