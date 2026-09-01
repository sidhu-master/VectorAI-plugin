// SPDX-License-Identifier: Apache-2.0

import type { ToleranceCatalogResult } from '@vectorai/plugin-space-contracts';
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';

export type ToleranceBand = ToleranceCatalogResult['bands'][number];

export interface ToleranceBandMatrixProps {
  bands: readonly ToleranceBand[];
  selectedDesignation?: string | null;
  zoom?: number;
  onPreview(designation: string): void;
  onInspect?(band: ToleranceBand | null): void;
}

export function ToleranceBandMatrix({
  bands,
  selectedDesignation = null,
  zoom = 1,
  onPreview,
  onInspect,
}: ToleranceBandMatrixProps) {
  const [search, setSearch] = useState('');
  const visibleBands = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query === '' ? [...bands] : bands.filter(({ designation }) => designation.toLocaleLowerCase().includes(query));
  }, [bands, search]);
  const available = visibleBands.filter(({ available: isAvailable }) => isAvailable);
  const [focusedDesignation, setFocusedDesignation] = useState<string | null>(() => available[0]?.designation ?? null);

  useEffect(() => {
    if (!available.some(({ designation }) => designation === focusedDesignation)) {
      setFocusedDesignation(available[0]?.designation ?? null);
    }
  }, [available, focusedDesignation]);

  const previewExactSearch = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    const exact = bands.find(({ designation, available: isAvailable }) => (
      isAvailable && designation.toLocaleLowerCase() === search.trim().toLocaleLowerCase()
    ));
    if (exact === undefined) return;
    event.preventDefault();
    setFocusedDesignation(exact.designation);
    onPreview(exact.designation);
  };
  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      const focused = available.find(({ designation }) => designation === focusedDesignation);
      if (focused === undefined) return;
      event.preventDefault();
      onPreview(focused.designation);
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || available.length === 0) return;
    event.preventDefault();
    const currentIndex = Math.max(0, available.findIndex(({ designation }) => designation === focusedDesignation));
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const nextIndex = (currentIndex + direction + available.length) % available.length;
    setFocusedDesignation(available[nextIndex]!.designation);
  };

  return <section className="vai-tolerance-matrix-shell">
    <label className="vai-tolerance-search">
      <span>直接搜索</span>
      <input
        data-tolerance-search={true}
        value={search}
        placeholder="H7、u6 或 H7/g6"
        onChange={(event) => setSearch(event.currentTarget.value)}
        onKeyDown={previewExactSearch}
      />
    </label>
    <div
      className="vai-tolerance-matrix"
      data-tolerance-band-matrix={true}
      tabIndex={0}
      onKeyDown={navigate}
      style={{ '--vai-tolerance-table-zoom': zoom } as React.CSSProperties}
    >
      {visibleBands.map((band) => <span
        key={`${band.featureClass}:${band.designation}`}
        className="vai-tolerance-band-wrapper"
        data-tolerance-band-wrapper={band.designation}
        onMouseEnter={() => onInspect?.(band)}
        onMouseLeave={() => onInspect?.(null)}
      >
        <button
          type="button"
          className={`vai-tolerance-band vai-tolerance-band--${band.category}`}
          data-tolerance-band={band.designation}
          data-band-category={band.category}
          data-available={String(band.available)}
          data-selected={selectedDesignation === band.designation ? 'true' : undefined}
          data-focused={focusedDesignation === band.designation ? 'true' : undefined}
          disabled={!band.available}
          title={band.available ? undefined : band.unavailableCode}
          onFocus={() => band.available && setFocusedDesignation(band.designation)}
          onClick={() => band.available && onPreview(band.designation)}
        >
          {band.designation}
          {band.category === 'preferred' && <span className="vai-tolerance-band__marker">优选</span>}
        </button>
      </span>)}
      {visibleBands.length === 0 && <p className="vai-tolerance-matrix__empty">没有匹配的公差代号</p>}
    </div>
  </section>;
}
