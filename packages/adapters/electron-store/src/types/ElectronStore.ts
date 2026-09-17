/**
 * The electron-store and conf methods used by the adapter.
 *
 * @example
 * ```ts
 * import Store from "electron-store";
 *
 * const store: ElectronStore = new Store();
 * ```
 */
export type ElectronStore = {
  // Method parameters must remain bivariant to accept the SDK's overloaded methods.
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  delete(key: string): void;
  has(key: string): boolean;
  store: Record<string, unknown>;
  onDidAnyChange(
    listener: (
      newValue?: Record<string, unknown>,
      oldValue?: Record<string, unknown>,
    ) => void,
  ): () => void;
};
