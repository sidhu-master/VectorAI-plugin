export function renderStartupError(error: unknown, logPath: string): string {
  const message = redact(error instanceof Error ? error.message : String(error));
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VectorAI 启动失败</title>
  <style>
    :root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #111820; color: #eef4f8; }
    main { width: min(620px, calc(100vw - 64px)); padding: 32px; border: 1px solid #34404b; border-radius: 14px; background: #1c2630; }
    h1 { margin: 0 0 16px; font-size: 24px; }
    p { line-height: 1.6; color: #bdc9d3; overflow-wrap: anywhere; }
    a { display: inline-block; margin-top: 12px; padding: 10px 18px; border-radius: 8px; background: #1aa7b8; color: white; text-decoration: none; }
    code { color: #e6d783; }
  </style>
</head>
<body><main>
  <h1>VectorAI 启动失败</h1>
  <p>${escapeHtml(message)}</p>
  <p>启动日志：<code>${escapeHtml(logPath)}</code></p>
  <a href="vectorai://retry">重试启动</a>
</main></body>
</html>`;
}

function redact(value: string): string {
  return value
    .replace(/([?&]token=)[^\s&#]+/giu, '$1[redacted]')
    .replace(/\b(api[_-]?key|key|authorization)\s*[:=]\s*[^\s,;]+/giu, '$1=[redacted]');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}
