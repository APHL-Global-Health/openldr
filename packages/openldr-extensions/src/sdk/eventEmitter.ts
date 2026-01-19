import { Disposable } from "../types";

// Event Emitter
export class EventEmitter<T = any> {
  private listeners: Array<(data: T) => void> = [];

  subscribe(listener: (data: T) => void): Disposable {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
          this.listeners.splice(index, 1);
        }
      },
    };
  }

  emit(data: T): void {
    this.listeners.forEach((listener) => listener(data));
  }
}
