import { describe, it, expect } from 'vitest';

describe('collection module', () => {
  it('can be imported outside Electron', async () => {
    const { Collection } = await import('../../src/main/collection.js');
    const collection = Collection.getInstance();

    expect(collection).toBeInstanceOf(Collection);
    expect(collection.root_path).toBeTypeOf('string');
    expect(collection.workflow_path).toMatch(/workflows$/);
  });
});
