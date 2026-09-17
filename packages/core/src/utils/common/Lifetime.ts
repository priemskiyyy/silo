import { captureError, combineErrors } from "src/utils/common/errors";

/**
 * Runs all cleanups once in reverse order, collecting failures.
 * Cleanups registered after disposal run immediately.
 */
export class Lifetime {
  #cleanups: Set<() => void> | null = new Set();

  get disposed() {
    return this.#cleanups === null;
  }

  add = (cleanup: () => void) => {
    const cleanups = this.#cleanups;
    if (cleanups === null) {
      cleanup();
      return () => {};
    }

    const release = () => {
      if (!cleanups.delete(release)) {
        return;
      }
      cleanup();
    };
    cleanups.add(release);
    return release;
  };

  /** Rolls back registered resources if acquisition throws. */
  setup = <TResult>(acquire: () => TResult): TResult => {
    try {
      return acquire();
    } catch (error) {
      throw combineErrors(
        [error, ...captureError(this.dispose)],
        "Silo setup and cleanup failed.",
      );
    }
  };

  dispose = () => {
    const cleanups = this.#cleanups;
    if (cleanups === null) {
      return;
    }

    this.#cleanups = null;
    const errors = [...cleanups].reverse().flatMap(captureError);

    if (errors.length > 0) {
      throw combineErrors(errors, "Silo cleanup failed.");
    }
  };
}
