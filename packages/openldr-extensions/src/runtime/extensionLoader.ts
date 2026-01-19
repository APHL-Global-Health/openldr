import { createExtensionContext } from "../sdk/storage";
import { Extension, ExtensionManifest } from "../types";
import * as exts from "../index";
import React from "react";

export class ExtensionLoader {
  private loadedExtensions = new Map<string, Extension>();
  private loadedManifests = new Map<string, ExtensionManifest>();
  private extensionContexts = new Map<string, any>();

  async loadExtension(
    manifest: ExtensionManifest,
    code: string
  ): Promise<void> {
    try {
      // Create a sandboxed environment
      const extension = await this.executeInSandbox(code, manifest);

      // Create extension context
      const context = createExtensionContext(manifest.id);
      this.extensionContexts.set(manifest.id, context);

      // Store extension
      this.loadedExtensions.set(manifest.id, extension);
      this.loadedManifests.set(manifest.id, manifest);

      // Activate extension
      await extension.activate(context);

      // console.log(`Extension ${manifest.name} loaded successfully`);
    } catch (error) {
      console.error(`Failed to load extension ${manifest.id}:`, error);
      throw error;
    }
  }

  private async executeInSandbox(
    code: string,
    manifest: ExtensionManifest
  ): Promise<Extension> {
    const module = { exports: {} };
    // const require = (moduleName: string) => {
    //   // Only allow specific modules
    //   if (moduleName === "@openldr/extensions") {
    //     return exts;
    //   } else if (moduleName === "react") {
    //     return React;
    //   }
    //   throw new Error(`Module ${moduleName} is not available`);
    // };

    const extensionFactory = new Function("module", "exports", code);
    extensionFactory(module, module.exports);

    // Handle both default export and direct export
    let extension: any = module.exports;

    // If it's an ES6 module with default export
    if (extension.default) {
      extension = extension.default;
    }

    // If extension is wrapped
    if (extension.ExtensionModule) {
      extension = extension.ExtensionModule;
    }

    // Validate extension structure
    if (!extension || !extension.activate) {
      console.error("Extension object:", extension);
      throw new Error("Extension must export an activate function");
    }

    return {
      ...extension,
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      manifest,
    };
  }

  async unloadExtension(extensionId: string): Promise<void> {
    const extension = this.loadedExtensions.get(extensionId);
    const context = this.extensionContexts.get(extensionId);

    if (extension && extension.deactivate) {
      await extension.deactivate();
    }

    // Dispose all subscriptions
    if (context?.subscriptions) {
      context.subscriptions.forEach((disposable: any) => disposable.dispose());
    }

    this.loadedExtensions.delete(extensionId);
    this.extensionContexts.delete(extensionId);
    this.loadedManifests.delete(extensionId);
  }

  getLoadedExtensions(): Extension[] {
    return Array.from(this.loadedExtensions.values());
  }

  getLoadedExtensionById(id: string): Extension | undefined {
    return this.loadedExtensions.get(id);
  }

  getLoadedManifestById(id: string): ExtensionManifest | undefined {
    return this.loadedManifests.get(id);
  }

  installExtension(id: string, state: boolean) {
    const extension: Extension | undefined = this.loadedExtensions.get(id);
    if (extension) {
      extension.installed = state;
      extension.enabled = state;
    }
  }

  enableExtension(id: string, state: boolean) {
    const extension: Extension | undefined = this.loadedExtensions.get(id);
    if (extension) extension.enabled = state;
  }

  isExtensionLoaded(extensionId: string): boolean {
    return this.loadedExtensions.has(extensionId);
  }
}

// Singleton instance
export const extensionLoader = new ExtensionLoader();
