import { Permission } from "../types";
import { permissionManager } from "./permissionManager";
import { commands } from "./commandRegistry";
import { ui } from "./uiRegistry";

export class SecureAPI {
  constructor(private extensionId: string) {}

  private async checkPermission(permission: Permission): Promise<void> {
    const hasPermission = await permissionManager.requestPermission(
      this.extensionId,
      permission
    );
    if (!hasPermission) {
      throw new Error(
        `Extension ${this.extensionId} does not have ${permission} permission`
      );
    }
  }

  // Secure command registration
  async registerCommand(commandId: string, callback: (...args: any[]) => any) {
    await this.checkPermission(Permission.COMMANDS_REGISTER);
    return commands.registerCommand(commandId, callback);
  }

  async executeCommand<T = unknown>(commandId: string, ...args: any[]) {
    await this.checkPermission(Permission.COMMANDS_EXECUTE);
    return commands.executeCommand<T>(commandId, ...args);
  }

  // Secure UI registration
  async registerUIComponent(contribution: any) {
    const slotPermissionMap: Record<string, Permission> = {
      sidebar: Permission.UI_SIDEBAR,
      panel: Permission.UI_PANEL,
      toolbar: Permission.UI_TOOLBAR,
      modal: Permission.UI_MODAL,
      statusbar: Permission.UI_STATUSBAR,
    };

    const requiredPermission = slotPermissionMap[contribution.slot];
    if (requiredPermission) {
      await this.checkPermission(requiredPermission);
    }

    return ui.registerUIComponent(contribution);
  }

  // Secure HTTP requests
  async fetch(url: string, options?: RequestInit): Promise<Response> {
    await this.checkPermission(Permission.NETWORK_HTTP);

    // Add extension identification header
    const headers = new Headers(options?.headers);
    headers.set("X-Extension-Id", this.extensionId);

    return fetch(url, {
      ...options,
      headers,
    });
  }

  // Secure clipboard access
  async readClipboard(): Promise<string> {
    await this.checkPermission(Permission.CLIPBOARD_READ);
    return navigator.clipboard.readText();
  }

  async writeClipboard(text: string): Promise<void> {
    await this.checkPermission(Permission.CLIPBOARD_WRITE);
    return navigator.clipboard.writeText(text);
  }

  // Secure notifications
  async showNotification(
    title: string,
    message: string,
    options?: { type?: "info" | "warning" | "error" }
  ): Promise<void> {
    await this.checkPermission(Permission.UI_NOTIFICATIONS);

    const event = new CustomEvent("extension:notification", {
      detail: {
        extensionId: this.extensionId,
        title,
        message,
        ...options,
      },
    });
    window.dispatchEvent(event);
  }
}
