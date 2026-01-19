import { Disposable, UIContribution } from "../types";

class UIRegistry {
  private components = new Map<string, UIContribution>();

  registerUIComponent(contribution: UIContribution): Disposable {
    this.components.set(contribution.id, contribution);
    return {
      dispose: () => this.components.delete(contribution.id),
    };
  }

  getComponentsForSlot(slot: string): UIContribution[] {
    return Array.from(this.components.values()).filter((c) => c.slot === slot);
  }

  getComponentById(id: string): UIContribution | undefined {
    return Array.from(this.components.values()).find(
      (c) => c.extensionId === id
    );
  }

  getComponents(): UIContribution[] {
    return Array.from(this.components.values());
  }
}

export const ui = new UIRegistry();
