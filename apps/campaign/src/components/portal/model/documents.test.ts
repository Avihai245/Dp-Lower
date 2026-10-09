import { describe, expect, it } from 'vitest';
import { crawlDuration, slotVisual, splitSlots } from './documents';

describe('slotVisual', () => {
  it('follows the status the server holds', () => {
    expect(slotVisual('missing', undefined)).toBe('empty');
    expect(slotVisual('requested', undefined)).toBe('requested');
    expect(slotVisual('received', undefined)).toBe('uploaded');
    expect(slotVisual('reupload', undefined)).toBe('error');
  });

  it('lets a live upload in this browser win, so a replacement shows its progress and its failure', () => {
    expect(slotVisual('missing', 'uploading')).toBe('uploading');
    expect(slotVisual('received', 'uploading')).toBe('uploading');
    expect(slotVisual('reupload', 'failed')).toBe('failed');
    expect(slotVisual('received', 'failed')).toBe('failed');
  });
});

describe('splitSlots', () => {
  it('puts everything the server has not accepted under "Not yet sent"', () => {
    const docs = [
      { id: 'a', status: 'received' as const },
      { id: 'b', status: 'reupload' as const },
      { id: 'c', status: 'missing' as const },
      { id: 'd', status: 'requested' as const },
      { id: 'e', status: 'received' as const },
    ];
    const { todo, got } = splitSlots(docs);
    expect(todo.map((d) => d.id)).toEqual(['b', 'c', 'd']);
    expect(got.map((d) => d.id)).toEqual(['a', 'e']);
  });
});

describe('crawlDuration', () => {
  it('is the prototype\'s 3.2 seconds for small files and grows with size up to a minute', () => {
    expect(crawlDuration(10_000)).toBe(3200);
    expect(crawlDuration(5 * 1024 * 1024)).toBe(20_972);
    expect(crawlDuration(20 * 1024 * 1024)).toBe(60_000);
  });
});
