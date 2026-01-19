import { Permission } from "../types";

export class PermissionManager {
  private granted = new Map<string, Set<Permission>>();
  private denied = new Map<string, Set<Permission>>();

  async requestPermission(
    extensionId: string,
    permission: Permission,
    reason?: string
  ): Promise<boolean> {
    // Check if already granted
    if (this.hasPermission(extensionId, permission)) {
      return true;
    }

    // Check if previously denied
    const deniedPerms = this.denied.get(extensionId);
    if (deniedPerms?.has(permission)) {
      return false;
    }

    // Request user consent
    const granted = await this.showPermissionDialog(
      extensionId,
      permission,
      reason
    );

    if (granted) {
      this.grantPermission(extensionId, permission);
    } else {
      this.denyPermission(extensionId, permission);
    }

    return granted;
  }

  hasPermission(extensionId: string, permission: Permission): boolean {
    return this.granted.get(extensionId)?.has(permission) || false;
  }

  grantPermission(extensionId: string, permission: Permission): void {
    if (!this.granted.has(extensionId)) {
      this.granted.set(extensionId, new Set());
    }
    this.granted.get(extensionId)!.add(permission);
    this.savePermissions();
  }

  denyPermission(extensionId: string, permission: Permission): void {
    if (!this.denied.has(extensionId)) {
      this.denied.set(extensionId, new Set());
    }
    this.denied.get(extensionId)!.add(permission);
    this.savePermissions();
  }

  revokePermission(extensionId: string, permission: Permission): void {
    this.granted.get(extensionId)?.delete(permission);
    this.savePermissions();
  }

  getGrantedPermissions(extensionId: string): Permission[] {
    return Array.from(this.granted.get(extensionId) || []);
  }

  private async showPermissionDialog(
    extensionId: string,
    permission: Permission,
    reason?: string
  ): Promise<boolean> {
    // This would show a modal in your app
    return new Promise((resolve) => {
      const event = new CustomEvent("extension:permission-request", {
        detail: {
          extensionId,
          permission,
          reason,
          resolve,
        },
      });
      window.dispatchEvent(event);
    });
  }

  private savePermissions(): void {
    const data = {
      granted: Array.from(this.granted.entries()).map(([id, perms]) => [
        id,
        Array.from(perms),
      ]),
      denied: Array.from(this.denied.entries()).map(([id, perms]) => [
        id,
        Array.from(perms),
      ]),
    };
    localStorage.setItem("extension-permissions", JSON.stringify(data));
  }

  loadPermissions(): void {
    try {
      const data = JSON.parse(
        localStorage.getItem("extension-permissions") || "{}"
      );
      if (data.granted) {
        this.granted = new Map(
          data.granted.map(([id, perms]: [string, Permission[]]) => [
            id,
            new Set(perms),
          ])
        );
      }
      if (data.denied) {
        this.denied = new Map(
          data.denied.map(([id, perms]: [string, Permission[]]) => [
            id,
            new Set(perms),
          ])
        );
      }
    } catch (error) {
      console.error("Failed to load permissions:", error);
    }
  }
}

export const permissionManager = new PermissionManager();
