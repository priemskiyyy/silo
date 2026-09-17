export const captureError = (task: () => void): unknown[] => {
  try {
    task();
    return [];
  } catch (error) {
    return [error];
  }
};

export const combineErrors = (errors: unknown[], message: string) =>
  errors.length === 1 ? errors[0] : new AggregateError(errors, message);

export const isolate = (run: () => void) => {
  try {
    const result: unknown = run();
    if (result !== undefined) {
      Promise.resolve(result).catch(reportUnhandledError);
    }
  } catch (error) {
    reportUnhandledError(error);
  }
};

export const reportUnhandledError = (error: unknown): void => {
  // Throw outside the notification chain so later listeners still run.
  queueMicrotask(() => {
    throw error;
  });
};
