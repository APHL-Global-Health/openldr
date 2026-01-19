import semver from "semver";

export interface ExtensionVersion {
  version: string;
  releaseDate: Date;
  changelog: string;
  breaking: boolean;
  minAppVersion?: string;
  maxAppVersion?: string;
}

export class VersionManager {
  private installedVersions = new Map<string, string>();

  constructor(private appVersion: string) {
    this.loadInstalledVersions();
  }

  isCompatible(extensionVersion: ExtensionVersion): {
    compatible: boolean;
    reason?: string;
  } {
    // Check min version
    if (
      extensionVersion.minAppVersion &&
      semver.lt(this.appVersion, extensionVersion.minAppVersion)
    ) {
      return {
        compatible: false,
        reason: `Requires app version ${extensionVersion.minAppVersion} or higher`,
      };
    }

    // Check max version
    if (
      extensionVersion.maxAppVersion &&
      semver.gt(this.appVersion, extensionVersion.maxAppVersion)
    ) {
      return {
        compatible: false,
        reason: `Not compatible with app version ${this.appVersion}`,
      };
    }

    return { compatible: true };
  }

  canUpdate(
    extensionId: string,
    newVersion: string
  ): { canUpdate: boolean; reason?: string } {
    const currentVersion = this.installedVersions.get(extensionId);

    if (!currentVersion) {
      return { canUpdate: true };
    }

    if (!semver.valid(newVersion)) {
      return { canUpdate: false, reason: "Invalid version format" };
    }

    if (semver.lte(newVersion, currentVersion)) {
      return {
        canUpdate: false,
        reason: "New version must be higher than current version",
      };
    }

    return { canUpdate: true };
  }

  checkForUpdates(
    extensionId: string,
    availableVersions: ExtensionVersion[]
  ): ExtensionVersion | undefined {
    const currentVersion = this.installedVersions.get(extensionId);
    if (!currentVersion) return undefined;

    const compatibleUpdates = availableVersions.filter((v) => {
      const isNewer = semver.gt(v.version, currentVersion);
      const isCompatible = this.isCompatible(v).compatible;
      return isNewer && isCompatible;
    });

    if (compatibleUpdates.length === 0) return undefined;

    // Return the latest compatible version
    return compatibleUpdates.sort((a, b) =>
      semver.compare(b.version, a.version)
    )[0];
  }

  setInstalledVersion(extensionId: string, version: string): void {
    this.installedVersions.set(extensionId, version);
    this.saveInstalledVersions();
  }

  getInstalledVersion(extensionId: string): string | undefined {
    return this.installedVersions.get(extensionId);
  }

  private loadInstalledVersions(): void {
    try {
      const data = JSON.parse(
        localStorage.getItem("extension-versions") || "{}"
      );
      this.installedVersions = new Map(Object.entries(data));
    } catch (error) {
      console.error("Failed to load extension versions:", error);
    }
  }

  private saveInstalledVersions(): void {
    const data = Object.fromEntries(this.installedVersions);
    localStorage.setItem("extension-versions", JSON.stringify(data));
  }

  // Rollback functionality
  async rollback(extensionId: string, targetVersion: string): Promise<void> {
    // This would need to fetch the specific version from the API
    this.setInstalledVersion(extensionId, targetVersion);
  }
}
