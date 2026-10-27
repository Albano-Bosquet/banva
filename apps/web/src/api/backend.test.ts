import { describe, expect, it } from 'vitest';
import { createShape } from '@trazo/shared';
import { getBackend } from './backend';

describe('modo local (sin API)', () => {
  it('crea, guarda, lista, duplica y elimina en localStorage', async () => {
    const b = await getBackend();
    expect(b.kind).toBe('local');
    const d = await b.create({ width: 800, height: 600 });
    const doc = structuredClone(d.doc);
    doc.pages[0].elements.push(createShape(doc, 'rect'));
    expect((await b.save(d.id, 0, doc)).revision).toBe(1);
    expect((await b.get(d.id)).doc.pages[0].elements).toHaveLength(1);
    const copy = await b.duplicate(d.id);
    expect(copy.doc.title).toMatch(/\(copia\)$/);
    expect((await b.list()).map((x) => x.id)).toEqual(expect.arrayContaining([d.id, copy.id]));
    await b.remove(d.id);
    await expect(b.get(d.id)).rejects.toThrow();
  });
});
