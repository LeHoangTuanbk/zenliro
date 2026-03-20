import { useMemo } from 'react';
import type { LibraryFilter } from '../const/filter';

export function useLibraryFilter(
  photos: ImportedPhoto[],
  catalogPhotos: CatalogPhoto[],
  filter: LibraryFilter,
) {
  const catalogMap = useMemo(() => {
    const map = new Map<string, CatalogPhoto>();
    catalogPhotos.forEach((p) => map.set(p.id, p));
    return map;
  }, [catalogPhotos]);

  const filtered = useMemo(() => {
    let result = photos;

    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter((p) => p.fileName.toLowerCase().includes(q));
    }

    if (filter.minRating > 0) {
      result = result.filter((p) => {
        const cat = catalogMap.get(p.id);
        return cat ? cat.rating === filter.minRating : false;
      });
    }

    if (filter.tags.length > 0) {
      result = result.filter((p) => {
        const cat = catalogMap.get(p.id);
        return cat ? filter.tags.some((t) => cat.tags.includes(t)) : false;
      });
    }

    if (filter.dateRange) {
      const { from, to } = filter.dateRange;
      result = result.filter((p) => p.importedAt >= from && p.importedAt <= to);
    }

    return result;
  }, [photos, catalogMap, filter]);

  return filtered;
}
