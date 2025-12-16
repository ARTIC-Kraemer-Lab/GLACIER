import Store from 'electron-store';

// Keep in sync with types/settings.js
export interface StoreSchema {
  collectionsPath: string;
  disableProjects: boolean;
  disableSchemaValidation: boolean;
}

const store = new Store<StoreSchema>({
  schema: {
    collectionsPath: {
      type: 'string',
      default: ''
    },
    disableProjects: {
      type: 'boolean',
      default: true
    },
    disableSchemaValidation: {
      type: 'boolean',
      default: false
    }
  },
  name: 'GLACIER'
});

export default store;
