import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const consumers = ['@sveltejs/vite-plugin-svelte', '@rollup/plugin-node-resolve'];

// Resolve through each real consumer so an override that misses a nested copy fails.
for (const consumer of consumers) {
  const merge = createRequire(require.resolve(consumer))('deepmerge');
  const ordinaryPrototype = Object.getPrototypeOf(merge({}, {}));

  describe(`deepmerge used by ${consumer}`, () => {
    it.each([
      ['null-prototype target', () => Object.create(null)],
      ['own __proto__ target', () => JSON.parse('{"__proto__":{}}')],
    ])('blocks prototype poisoning with a %s', (_, target) => {
      const source = JSON.parse('{"__proto__":{"polluted":true},"safe":1}');
      const result = merge(target(), source);
      expect(Object.getPrototypeOf(result)).toBe(ordinaryPrototype);
      expect(result.polluted).toBeUndefined();
      expect(result.safe).toBe(1);
      expect({}.polluted).toBeUndefined();
    });

    it('does not poison the result when cloning the target or nested arrays', () => {
      const payload = JSON.parse('{"__proto__":{"polluted":true},"safe":1}');
      const result = merge(payload, {});
      const nested = merge({}, { items: [payload] });
      for (const value of [result, nested.items[0]]) {
        expect(Object.getPrototypeOf(value)).toBe(ordinaryPrototype);
        expect(value.polluted).toBeUndefined();
        expect(value.safe).toBe(1);
      }
    });

    it('never reads a dangerous getter on either input', () => {
      const payload = Object.defineProperty({ safe: 1 }, '__proto__', {
        enumerable: true,
        get() {
          throw new Error('The prototype payload must not be evaluated');
        },
      });
      expect(merge(payload, {})).toEqual({ safe: 1 });
      expect(merge(Object.create(null), payload)).toEqual({ safe: 1 });
    });

    it('protects the returned prototype even when cloning is disabled', () => {
      const payload = JSON.parse('{"__proto__":{"polluted":true},"safe":1}');
      const result = merge(Object.create(null), payload, { clone: false });
      expect(Object.getPrototypeOf(result)).toBe(ordinaryPrototype);
      expect(result.polluted).toBeUndefined();
      expect(result.safe).toBe(1);
    });

    it('keeps constructor/prototype input from modifying Object.prototype', () => {
      merge({}, JSON.parse('{"constructor":{"prototype":{"polluted":true}}}'));
      expect({}.polluted).toBeUndefined();
    });

    it('preserves config merging, array replacement and special objects', () => {
      const date = new Date();
      const pattern = /svelte/;
      const symbol = Symbol('config');
      const original = { nested: { first: 1 }, entries: ['first'], date, pattern, [symbol]: 7 };
      const result = merge(
        original,
        { nested: { second: 2 }, entries: ['second'] },
        {
          arrayMerge: (_, source) => source,
        }
      );
      expect(result.nested).toEqual({ first: 1, second: 2 });
      expect(original.nested).toEqual({ first: 1 });
      expect(result.entries).toEqual(['second']);
      expect(result.date).toBe(date);
      expect(result.pattern).toBe(pattern);
      expect(result[symbol]).toBe(7);
    });

    it('preserves the all and customMerge APIs and default array cloning', () => {
      const entry = { id: 1 };
      const result = merge.all([{ items: [entry] }, { items: [{ id: 2 }] }]);
      expect(result.items).toEqual([{ id: 1 }, { id: 2 }]);
      expect(result.items[0]).not.toBe(entry);
      const custom = merge(
        { nested: { first: 1 } },
        { nested: { second: 2 } },
        {
          customMerge: (key) => (key === 'nested' ? (_, source) => source : undefined),
        }
      );
      expect(custom.nested).toEqual({ second: 2 });
    });
  });
}
