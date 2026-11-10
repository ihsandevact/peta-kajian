import { describe, it, expect } from 'vitest';
import { pinActiveVideoToTop } from '@/lib/services/youtubeTracker';

describe('pinActiveVideoToTop', () => {
  it('harus mengembalikan list yang sama jika list kosong atau hanya memiliki 1 elemen', () => {
    expect(pinActiveVideoToTop([], (x: any) => x.id === '1')).toEqual([]);
    expect(pinActiveVideoToTop([{ id: 'a' }], (x) => x.id === 'a')).toEqual([{ id: 'a' }]);
  });

  it('harus memindahkan item yang cocok dari tengah ke index 0', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const result = pinActiveVideoToTop(items, (x) => x.id === 'c');

    expect(result).toEqual([{ id: 'c' }, { id: 'a' }, { id: 'b' }, { id: 'd' }]);
    // Pastikan tidak memutasi array asli
    expect(items[0].id).toBe('a');
  });

  it('harus memindahkan item yang cocok dari posisi paling akhir ke index 0', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const result = pinActiveVideoToTop(items, (x) => x.id === 'c');

    expect(result).toEqual([{ id: 'c' }, { id: 'a' }, { id: 'b' }]);
  });

  it('harus mempertahankan urutan jika item yang cocok sudah berada di index 0', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const result = pinActiveVideoToTop(items, (x) => x.id === 'a');

    expect(result).toEqual(items);
  });

  it('harus mengembalikan list awal jika tidak ada item yang cocok', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const result = pinActiveVideoToTop(items, (x) => x.id === 'not-found');

    expect(result).toEqual(items);
  });
});
