import { Disposable } from "../types";

// Command Registry
class CommandRegistry {
  private commands = new Map<string, (...args: any[]) => any>();

  registerCommand(
    commandId: string,
    callback: (...args: any[]) => any
  ): Disposable {
    this.commands.set(commandId, callback);
    return {
      dispose: () => this.commands.delete(commandId),
    };
  }

  executeCommand<T = unknown>(commandId: string, ...args: any[]): Promise<T> {
    const command = this.commands.get(commandId);
    if (!command) {
      throw new Error(`Command '${commandId}' not found`);
    }
    return Promise.resolve(command(...args));
  }

  getCommands(): string[] {
    return Array.from(this.commands.keys());
  }
}

export const commands = new CommandRegistry();
