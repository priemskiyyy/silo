import type { KeychainModule } from "src/types/KeychainModule";

type Entry = { username: string; password: string };

// The native module is not installable here, so the fake is its contract:
// entries by service, refusing the service names the Android keystore
// refuses, which is what makes the suite's opaque-key block prove the
// encoding. `refuse` makes the next write answer `false`, as the module does
// when the platform declines.
export const createFakeKeychain = () => {
  const entries = new Map<string, Entry>();
  let refusals = 0;
  const assertService = (service: string | undefined) => {
    if (service === undefined || !/^[A-Za-z0-9._-]+$/.test(service)) {
      throw new Error(`The keychain refuses the service "${service}".`);
    }

    return service;
  };
  const module: KeychainModule = {
    setGenericPassword: async (username, password, options) => {
      const service = assertService(options?.service);

      if (refusals > 0) {
        refusals -= 1;
        return false;
      }

      entries.set(service, { username, password });
      return { service, storage: "fake" };
    },
    getGenericPassword: async (options) => {
      const service = assertService(options?.service);
      const entry = entries.get(service);

      return entry === undefined
        ? false
        : { ...entry, service, storage: "fake" };
    },
    resetGenericPassword: async (options) =>
      entries.delete(assertService(options?.service)),
    getAllGenericPasswordServices: async () => [...entries.keys()],
  };

  return {
    entries,
    module,
    refuse: () => {
      refusals += 1;
    },
  };
};
