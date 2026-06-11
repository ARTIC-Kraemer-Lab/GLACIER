import { describe, it, expect } from 'vitest';

describe('collection module', () => {
  it('can be imported outside Electron', async () => {
    const { Collection } = await import('../../src/main/collection.js');
    expect(Collection.getInstance()).toBeInstanceOf(Collection);
  });
});
