/** The Lab's hand on the journal: `arm` it, and the next write is refused. Closure state, so a memoized store is never mutated from a handler. */
export const createFaults = () => {
  let armed = false;

  return {
    arm: () => {
      armed = true;
    },
    /** Answers whether a fault was armed, and disarms it either way. */
    take: () => {
      const wasArmed = armed;
      armed = false;
      return wasArmed;
    },
  };
};

export type Faults = ReturnType<typeof createFaults>;
