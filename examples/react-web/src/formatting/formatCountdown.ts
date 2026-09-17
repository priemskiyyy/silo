/** Milliseconds as `mm:ss`, never negative. */
export const formatCountdown = (remaining: number) => {
  const seconds = Math.max(0, Math.ceil(remaining / 1_000));
  const minutes = Math.floor(seconds / 60);

  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};
