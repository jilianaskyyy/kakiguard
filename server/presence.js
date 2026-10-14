// Tracks who is online (for the green dots in Safety Circle)
const online = new Map(); // userId -> number of open connections

export const markOnline = (id) => online.set(id, (online.get(id) || 0) + 1);
export const markOffline = (id) => {
  const n = (online.get(id) || 1) - 1;
  if (n <= 0) online.delete(id); else online.set(id, n);
};
export const isOnline = (id) => online.has(id);
