import { Memento, ExtensionContext } from "../types";

// Storage implementation
class Storage implements Memento {
  constructor(private prefix: string) {}

  get<T>(key: string, defaultValue?: T): T | undefined {
    const value = localStorage.getItem(`${this.prefix}:${key}`);
    if (value === null) return defaultValue;
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  }

  async update(key: string, value: any): Promise<void> {
    if (value === undefined) {
      localStorage.removeItem(`${this.prefix}:${key}`);
    } else {
      localStorage.setItem(`${this.prefix}:${key}`, JSON.stringify(value));
    }
  }
}

export function createExtensionContext(extensionId: string): ExtensionContext {
  return {
    subscriptions: [],
    workspaceState: new Storage(`ext:${extensionId}:workspace`),
    globalState: new Storage(`ext:${extensionId}:global`),
    extensionPath: `/extensions/${extensionId}`,
    extensionUri: `/extensions/${extensionId}`,
  };
}
