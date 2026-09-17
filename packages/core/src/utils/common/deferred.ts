export const deferred = <TValue = void>() => {
  let resolve: (value: TValue | PromiseLike<TValue>) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<TValue>((fulfil, fail) => {
    resolve = fulfil;
    reject = fail;
  });
  // Attached before anyone can await: a failure nobody was listening for must
  // not surface as an unhandled rejection.
  promise.catch(() => {});

  return { promise, resolve, reject };
};
