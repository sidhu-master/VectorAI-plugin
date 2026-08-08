import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CanvasErrorBoundary, CanvasErrorFallback } from './CanvasErrorBoundary';

describe('CanvasErrorBoundary', () => {
  it('projects a thrown renderer error into isolated boundary state', () => {
    const error = new Error('bad CAD geometry');

    expect(CanvasErrorBoundary.getDerivedStateFromError(error)).toEqual({ error });
  });

  it('renders a local recovery action without exposing a stack trace', () => {
    const html = renderToStaticMarkup(
      <CanvasErrorFallback error={new Error('private stack detail')} onRetry={() => undefined} />,
    );

    expect(html).toContain('画布暂时无法显示');
    expect(html).toContain('重新加载画布');
    expect(html).not.toContain('private stack detail');
  });
});
