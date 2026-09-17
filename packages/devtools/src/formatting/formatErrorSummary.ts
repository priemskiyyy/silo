/** One-line text for a cause: an error's message, a string as it is, or a generic label. */
export const formatErrorSummary = (cause: unknown) => {
  if (typeof cause === "string") {
    return cause;
  }

  if (typeof cause === "object" && cause !== null && "message" in cause) {
    if (typeof cause.message === "string") {
      return cause.message;
    }
  }

  return "Unknown error";
};
