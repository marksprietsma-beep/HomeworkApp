type PendingSave = Promise<unknown>;

const queues = new Map<string, PendingSave>();

/** Orders autosaves for one student/assignment in the process that accepted them. */
export function runAutosaveSequentially<T>(key: string, save: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(save);
  queues.set(key, current);
  void current.finally(() => {
    if (queues.get(key) === current) queues.delete(key);
  }).catch(() => undefined);
  return current;
}
