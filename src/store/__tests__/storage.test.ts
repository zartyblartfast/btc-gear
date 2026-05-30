import { describe, expect, it } from 'vitest';
import { createBrowserStorage, createMemoryStorage } from '../storage';

describe('createMemoryStorage', () => {
  it('returns null for missing keys', () => {
    const storage = createMemoryStorage();

    expect(storage.getItem('missing')).toBeNull();
  });

  it('reads initial values and keeps mutations local to the adapter', () => {
    const initial = { existing: 'value' };
    const storage = createMemoryStorage(initial);

    initial.existing = 'changed-after-create';
    storage.setItem('new-key', 'new-value');

    expect(storage.getItem('existing')).toBe('value');
    expect(storage.getItem('new-key')).toBe('new-value');
  });

  it('removes values', () => {
    const storage = createMemoryStorage({ profile: 'saved' });

    storage.removeItem('profile');

    expect(storage.getItem('profile')).toBeNull();
  });
});

describe('createBrowserStorage', () => {
  it('delegates get, set, and remove to the injected Storage implementation', () => {
    const calls: string[] = [];
    const backing = new Map<string, string>();
    const fakeStorage = {
      getItem(key: string) {
        calls.push(`get:${key}`);
        return backing.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        calls.push(`set:${key}:${value}`);
        backing.set(key, value);
      },
      removeItem(key: string) {
        calls.push(`remove:${key}`);
        backing.delete(key);
      },
    } as Storage;

    const storage = createBrowserStorage(fakeStorage);

    storage.setItem('profile', '{"ok":true}');
    expect(storage.getItem('profile')).toBe('{"ok":true}');
    storage.removeItem('profile');
    expect(storage.getItem('profile')).toBeNull();
    expect(calls).toEqual([
      'set:profile:{"ok":true}',
      'get:profile',
      'remove:profile',
      'get:profile',
    ]);
  });
});
