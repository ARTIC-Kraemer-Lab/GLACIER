import { createRequire } from 'module';

// Keep in sync with types/settings.js
export interface StoreSchema {
  collectionsPath: string;
  darkMode: boolean;
  permitAddCatalogues: boolean;
  permitCatalogueModifications: boolean;
  permitAddRepos: boolean;
  disableSchemaValidation: boolean;
}

type StoreLike = {
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K];
  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void;
};

const require = createRequire(import.meta.url);

const defaults: StoreSchema = {
  collectionsPath: '',
  darkMode: false,
  permitAddCatalogues: true,
  permitCatalogueModifications: true,
  permitAddRepos: true,
  disableSchemaValidation: false
};

function createFallbackStore(): StoreLike {
  const values: StoreSchema = { ...defaults };
  return {
    get<K extends keyof StoreSchema>(key: K): StoreSchema[K] {
      return values[key];
    },
    set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void {
      values[key] = value;
    }
  };
}

function createStore(): StoreLike {
  if (process.versions?.electron === undefined) {
    return createFallbackStore();
  }

  const ElectronStore = require('electron-store').default;
  return new ElectronStore({
    schema: {
      collectionsPath: {
        type: 'string',
        default: defaults.collectionsPath
      },
      darkMode: {
        type: 'boolean',
        default: defaults.darkMode
      },
      permitAddCatalogues: {
        type: 'boolean',
        default: defaults.permitAddCatalogues
      },
      permitCatalogueModifications: {
        type: 'boolean',
        default: defaults.permitCatalogueModifications
      },
      permitAddRepos: {
        type: 'boolean',
        default: defaults.permitAddRepos
      },
      disableSchemaValidation: {
        type: 'boolean',
        default: defaults.disableSchemaValidation
      }
    },
    name: 'GLACIER'
  }) as StoreLike;
}

const store = createStore();

export default store;
