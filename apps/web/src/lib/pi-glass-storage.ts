import {
  AppStorage,
  CustomProvidersStore,
  IndexedDBStorageBackend,
  ProviderKeysStore,
  SessionsStore,
  SettingsStore,
  setAppStorage,
} from "@mariozechner/pi-web-ui";

const PI_INDEXED_DB_NAME = "c-glass-glass-pi";
const PI_INDEXED_DB_VERSION = 2;

let initPromise: Promise<AppStorage> | null = null;

export function ensurePiGlassStorage(): Promise<AppStorage> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const settings = new SettingsStore();
    const providerKeys = new ProviderKeysStore();
    const sessions = new SessionsStore();
    const customProviders = new CustomProvidersStore();

    const storeConfigs = [
      settings.getConfig(),
      SessionsStore.getMetadataConfig(),
      providerKeys.getConfig(),
      customProviders.getConfig(),
      sessions.getConfig(),
    ];

    const backend = new IndexedDBStorageBackend({
      dbName: PI_INDEXED_DB_NAME,
      version: PI_INDEXED_DB_VERSION,
      stores: storeConfigs,
    });

    settings.setBackend(backend);
    providerKeys.setBackend(backend);
    customProviders.setBackend(backend);
    sessions.setBackend(backend);

    const storage = new AppStorage(settings, providerKeys, sessions, customProviders, backend);
    setAppStorage(storage);
    return storage;
  })();

  return initPromise;
}
