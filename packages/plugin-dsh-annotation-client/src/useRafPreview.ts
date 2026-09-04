// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef } from 'react';

export function useRafPreview<Value>(apply: (value: Value) => void) {
  const applyRef = useRef(apply);
  const pendingRef = useRef<Value | undefined>(undefined);
  const hasPendingRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  applyRef.current = apply;

  const cancel = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    pendingRef.current = undefined;
    hasPendingRef.current = false;
  }, []);

  const flush = useCallback((value: Value) => {
    pendingRef.current = value;
    hasPendingRef.current = true;
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    const pending = pendingRef.current as Value;
    pendingRef.current = undefined;
    hasPendingRef.current = false;
    applyRef.current(pending);
  }, []);

  const schedule = useCallback((value: Value) => {
    pendingRef.current = value;
    hasPendingRef.current = true;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      if (!hasPendingRef.current) return;
      const pending = pendingRef.current as Value;
      pendingRef.current = undefined;
      hasPendingRef.current = false;
      applyRef.current(pending);
    });
  }, []);

  useEffect(() => cancel, [cancel]);
  return { schedule, flush, cancel };
}
