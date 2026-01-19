type ExtensionEventType =
  | "extension:installed"
  | "extension:uninstalled"
  | "extension:enabled"
  | "extension:disabled"
  | "extension:updated";

interface ExtensionEventDetail {
  extensionId: string;
  type: ExtensionEventType;
}

export const extensionEvents = {
  emit: (type: ExtensionEventType, extensionId: string) => {
    const event = new CustomEvent("extension:change", {
      detail: { extensionId, type } as ExtensionEventDetail,
    });
    window.dispatchEvent(event);
  },

  subscribe: (callback: (detail: ExtensionEventDetail) => void) => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<ExtensionEventDetail>;
      callback(customEvent.detail);
    };

    window.addEventListener("extension:change", handler);

    return () => {
      window.removeEventListener("extension:change", handler);
    };
  },
};
