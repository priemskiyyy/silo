const formatter = new Intl.DateTimeFormat("en", {
  hour: "2-digit",
  minute: "2-digit",
});

export const formatClockTime = (timestamp: number) =>
  formatter.format(new Date(timestamp));
