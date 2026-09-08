// SPDX-License-Identifier: Apache-2.0

import type { DxfBlockGraphic, DxfExportProfile, Vec2 } from '@vectorai/drawing-core';
import type { ReactNode } from 'react';

/** DXF cached graphics in the same Y-up physical coordinates as the paper scene. */
export function CadPaperGraphics({ picture, profile }: {
  picture: readonly DxfBlockGraphic[];
  profile: DxfExportProfile;
}) {
  return <g data-cad-paper-graphics="true" pointerEvents="none">
    {picture.map((graphic, index) => <PaperGraphic key={index} graphic={graphic} profile={profile} />)}
  </g>;
}

function PaperGraphic({ graphic, profile }: { graphic: DxfBlockGraphic; profile: DxfExportProfile }) {
  const layer = profile.layers.find(({ name }) => name === graphic.layer);
  const color = resolveColor(graphic.color, graphic.layer, profile);
  const pattern = profile.lineTypes.find(({ name }) => name === layer?.lineType)?.pattern;
  const stroke = {
    stroke: color, fill: 'none', strokeWidth: layer?.lineWeight && layer.lineWeight > 0 ? layer.lineWeight / 100 : 0.18,
    strokeLinecap: 'butt' as const, strokeLinejoin: 'round' as const,
    ...(graphic.layer === profile.semanticLayers.omittedDimension ? { strokeOpacity: 0.45 } : {}),
    ...(pattern?.length ? { strokeDasharray: pattern.map((value) => Math.max(Math.abs(value), 0.18)).join(' ') } : {}),
  };
  switch (graphic.type) {
    case 'line': return <line x1={graphic.start[0]} y1={graphic.start[1]} x2={graphic.end[0]} y2={graphic.end[1]} {...stroke} />;
    case 'polyline': return graphic.closed
      ? <polygon points={points(graphic.points)} {...stroke} />
      : <polyline points={points(graphic.points)} {...stroke} />;
    case 'circle': return <circle cx={graphic.center[0]} cy={graphic.center[1]} r={graphic.radius} {...stroke} />;
    case 'arc': {
      const sweep = ((graphic.endAngle - graphic.startAngle) % 360 + 360) % 360;
      if (Math.abs(sweep) < 1e-9 && Math.abs(graphic.endAngle - graphic.startAngle) >= 359.999) {
        return <circle cx={graphic.center[0]} cy={graphic.center[1]} r={graphic.radius} {...stroke} />;
      }
      const at = (degrees: number): Vec2 => [graphic.center[0] + graphic.radius * Math.cos(degrees * Math.PI / 180), graphic.center[1] + graphic.radius * Math.sin(degrees * Math.PI / 180)];
      const a = at(graphic.startAngle); const b = at(graphic.endAngle);
      return <path d={`M ${a[0]} ${a[1]} A ${graphic.radius} ${graphic.radius} 0 ${sweep > 180 ? 1 : 0} 1 ${b[0]} ${b[1]}`} {...stroke} />;
    }
    case 'solid-hatch': return graphic.boundary.length < 3 ? null : <polygon points={points(graphic.boundary)} fill={color} stroke="none" />;
    case 'text':
    case 'mtext': return <PaperText graphic={graphic} profile={profile} color={color} />;
  }
}

interface TextStyle { height: number; width: number; font: string; color: string }
type Run = { type: 'text'; content: string; style: TextStyle }
  | { type: 'stack'; upper: string; lower: string; separator: string; style: TextStyle }
  | { type: 'break' };

function PaperText({ graphic, profile, color }: {
  graphic: Extract<DxfBlockGraphic, { type: 'text' | 'mtext' }>; profile: DxfExportProfile; color: string;
}) {
  const named = graphic.type === 'mtext' ? profile.textStyles.find(({ name }) => name === graphic.style) : undefined;
  const initial: TextStyle = {
    height: graphic.height,
    width: graphic.type === 'text' ? profile.plainTextWidthFactor ?? profile.textStyles[0]?.widthFactor ?? 1 : named?.widthFactor ?? 1,
    font: named?.font ?? profile.textStyles[0]?.font ?? 'sans-serif', color,
  };
  const runs = graphic.type === 'mtext' ? parseMtext(graphic.content, initial, graphic.layer, profile)
    : [{ type: 'text' as const, content: decodeSymbols(graphic.content), style: initial }];
  const paragraphs: Exclude<Run, { type: 'break' }>[][] = [[]];
  for (const run of runs) {
    if (run.type === 'break') paragraphs.push([]); else paragraphs.at(-1)!.push(run);
  }
  let baseline = 0;
  const lines = paragraphs.map((row) => {
    let x = 0; let top = -graphic.height; let bottom = 0;
    const items = row.map((run) => {
      const symbol = run.type === 'text' && isSymbolFont(run.style.font) ? symbolName(run.content) : undefined;
      const width = run.type === 'stack'
        ? Math.max(textWidth(run.upper, run.style), textWidth(run.lower, run.style)) + graphic.height * 0.08
        : symbol ? run.style.height : textWidth(run.content, run.style);
      const item = { run, x, width, symbol };
      x += width;
      if (run.type === 'stack') {
        top = Math.min(top, -graphic.height * 0.6 - run.style.height);
        bottom = Math.max(bottom, -graphic.height * 0.4 + run.style.height);
      } else top = Math.min(top, -run.style.height);
      return item;
    });
    const line = { items, width: x, top: baseline + top, bottom: baseline + bottom, baseline };
    baseline += Math.max(graphic.height * 1.67, bottom - top + graphic.height * 0.2);
    return line;
  });
  const top = Math.min(...lines.map((line) => line.top));
  const bottom = Math.max(...lines.map((line) => line.bottom));
  const attachment = graphic.type === 'mtext' ? graphic.alignment ?? 5 : graphic.alignment === 'left' ? 4 : graphic.alignment === 'right' ? 6 : 5;
  const horizontal = (attachment - 1) % 3;
  const vertical = Math.floor((attachment - 1) / 3);
  const y = vertical === 0 ? -top : vertical === 2 ? -bottom : -(top + bottom) / 2;
  return <g data-cad-paper-text="true" transform={`translate(${graphic.position[0]} ${graphic.position[1]}) rotate(${graphic.rotation ?? 0}) scale(1 -1)`}>
    {lines.map((line, row) => <g key={row} transform={`translate(${horizontal === 1 ? -line.width / 2 : horizontal === 2 ? -line.width : 0} ${y + line.baseline})`}>
      {line.items.map(({ run, x, width, symbol }, index) => {
        if (run.type === 'stack') return <g key={index} data-cad-stack="true" transform={`translate(${x} 0)`}>
          <TextRun content={run.upper} style={run.style} x={0} y={-graphic.height * 0.6} />
          <TextRun content={run.lower} style={run.style} x={0} y={-graphic.height * 0.4 + run.style.height} />
          {run.separator === '/' ? <line x1={0} y1={-graphic.height / 2} x2={width} y2={-graphic.height / 2} stroke={run.style.color} strokeWidth={graphic.height * 0.04} /> : null}
        </g>;
        return symbol ? <GdtGlyph key={index} name={symbol} x={x} height={run.style.height} color={run.style.color} />
          : <TextRun key={index} content={run.content} style={run.style} x={x} y={0} />;
      })}
    </g>)}
  </g>;
}

function TextRun({ content, style, x, y }: { content: string; style: TextStyle; x: number; y: number }) {
  if (!content) return null;
  return <text x={x} y={y} fill={style.color} stroke="none" fontSize={style.height / 0.72}
    fontFamily={browserFont(style.font)} textLength={textWidth(content, style)} lengthAdjust="spacingAndGlyphs"
    data-cap-height={Number(style.height.toFixed(8))} data-width-factor={style.width} xmlSpace="preserve">{content}</text>;
}

/** Only interprets DXF formatting; no model/user intent is inferred here. */
function parseMtext(content: string, initial: TextStyle, layer: string, profile: DxfExportProfile): Run[] {
  const runs: Run[] = [];
  let style = { ...initial }; const stack: TextStyle[] = [];
  let buffer = '';
  const flush = () => { if (buffer) runs.push({ type: 'text', content: decodeSymbols(buffer), style: { ...style } }); buffer = ''; };
  for (let index = 0; index < content.length;) {
    const character = content[index++];
    if (character === '{') { flush(); stack.push({ ...style }); continue; }
    if (character === '}') { flush(); style = stack.pop() ?? { ...initial }; continue; }
    if (character === '\n') { flush(); runs.push({ type: 'break' }); continue; }
    if (character !== '\\') { buffer += character; continue; }
    const code = content[index++];
    if (code === '\\' || code === '{' || code === '}') { buffer += code; continue; }
    if (code === '~') { buffer += '\u00a0'; continue; }
    if (code === 'P') { flush(); runs.push({ type: 'break' }); continue; }
    if (code === 'U' && content[index] === '+') {
      const hex = content.slice(index + 1, index + 5);
      if (/^[0-9a-f]{4}$/i.test(hex)) { buffer += String.fromCharCode(parseInt(hex, 16)); index += 5; continue; }
    }
    if ('LlOoKk'.includes(code)) continue;
    const semicolon = content.indexOf(';', index);
    if (semicolon < 0) { buffer += code ?? ''; continue; }
    const value = content.slice(index, semicolon); index = semicolon + 1;
    flush();
    if (code === 'H') { const height = parseFloat(value); if (Number.isFinite(height) && height > 0) style.height = value.endsWith('x') ? initial.height * height : height; }
    else if (code === 'W') { const width = parseFloat(value); if (Number.isFinite(width) && width > 0) style.width = width; }
    else if (code === 'F' || code === 'f') style.font = value.split(/[|,]/)[0];
    else if (code === 'C') style.color = resolveColor(Number(value), layer, profile);
    else if (code === 'c' && Number.isFinite(Number(value))) style.color = `#${(Number(value) & 0xffffff).toString(16).padStart(6, '0')}`;
    else if (code === 'S') {
      const separator = value.search(/[\^/#]/);
      runs.push({ type: 'stack', upper: decodeSymbols(separator < 0 ? value : value.slice(0, separator)),
        lower: decodeSymbols(separator < 0 ? '' : value.slice(separator + 1).replace(/^ /, '')), separator: value[separator] ?? '^', style: { ...style } });
    }
  }
  flush();
  return runs;
}

function decodeSymbols(value: string): string {
  return value.replace(/%%[cC]/g, '⌀').replace(/%%[dD]/g, '°').replace(/%%[pP]/g, '±');
}
function points(values: readonly Vec2[]): string { return values.map((value) => `${value[0]},${value[1]}`).join(' '); }
function textWidth(content: string, style: TextStyle): number {
  return [...content].reduce((sum, char) => sum + (char === ' ' || char === '\u00a0' ? 0.34 : '.,:;!|il'.includes(char) ? 0.3 : 'MW@'.includes(char) ? 0.85 : char.codePointAt(0)! > 255 ? 1 : 0.62) * style.height * style.width, 0);
}
function browserFont(font: string): string {
  // CAD SHX faces cannot be loaded by a browser. Keep physical width explicit
  // and select a installed stroke-like face; font matching remains CAD-specific.
  return /^(isocp|txt|simplex|romans)(\.shx)?$/i.test(font)
    ? '"Arial Narrow", "Liberation Sans Narrow", Arial, sans-serif'
    : `"${font.replace(/["\\]/g, '')}", Arial, sans-serif`;
}
function isSymbolFont(font: string): boolean { return /^amgdt(?:\.shx)?$/i.test(font); }

const SYMBOLS: Record<string, string> = {
  u: 'straightness', c: 'flatness', e: 'circularity', g: 'cylindricity', k: 'profile-line', d: 'profile-surface',
  f: 'parallelism', b: 'perpendicularity', a: 'angularity', j: 'position', r: 'coaxiality', i: 'symmetry', h: 'circular-runout', t: 'total-runout',
};
function symbolName(code: string): string | undefined { return SYMBOLS[code.trim()]; }

/** Standard geometric tolerance glyphs, independent of an installed amgdt face. */
function GdtGlyph({ name, x, height, color }: { name: string; x: number; height: number; color: string }) {
  let graphic: ReactNode;
  const arrow = 'M .14 .86 L .8 .2 M .48 .2 L .8 .2 L .8 .52';
  switch (name) {
    case 'straightness': graphic = <path d="M .05 .5 L .95 .5" />; break;
    case 'flatness': graphic = <path d="M .05 .7 L .3 .3 L .95 .3 L .7 .7 Z" />; break;
    case 'circularity': graphic = <circle cx={0.5} cy={0.5} r={0.4} />; break;
    case 'cylindricity': graphic = <><circle cx={0.5} cy={0.5} r={0.28} /><path d="M .04 .88 L .34 .12 M .66 .88 L .96 .12" /></>; break;
    case 'profile-line': graphic = <path d="M .06 .75 A .44 .6 0 0 1 .94 .75" />; break;
    case 'profile-surface': graphic = <path d="M .06 .75 A .44 .6 0 0 1 .94 .75 Z" />; break;
    case 'parallelism': graphic = <path d="M .18 .9 L .46 .1 M .54 .9 L .82 .1" />; break;
    case 'perpendicularity': graphic = <path d="M .1 .85 L .9 .85 M .5 .85 L .5 .1" />; break;
    case 'angularity': graphic = <path d="M .9 .85 L .12 .85 L .75 .15" />; break;
    case 'position': graphic = <><circle cx={0.5} cy={0.5} r={0.3} /><path d="M .02 .5 L .98 .5 M .5 .02 L .5 .98" /></>; break;
    case 'coaxiality': graphic = <><circle cx={0.5} cy={0.5} r={0.42} /><circle cx={0.5} cy={0.5} r={0.24} /></>; break;
    case 'symmetry': graphic = <path d="M .2 .25 L .8 .25 M .04 .5 L .96 .5 M .2 .75 L .8 .75" />; break;
    case 'circular-runout': graphic = <path d={arrow} />; break;
    default: graphic = <><path d="M .02 .86 L .57 .22 M .3 .22 L .57 .22 L .57 .49 M .39 .86 L .94 .22 M .67 .22 L .94 .22 L .94 .49 M .02 .86 L .39 .86" /></>;
  }
  return <g data-gdt-symbol={name} transform={`translate(${x} ${-height}) scale(${height})`} stroke={color} fill="none" strokeWidth={0.07} strokeLinecap="square" strokeLinejoin="miter">{graphic}</g>;
}

function resolveColor(aci: number | undefined, layer: string, profile: DxfExportProfile): string {
  // Picture blocks have no explicit INSERT color: BYBLOCK inherits CAD white.
  // BYLAYER and omitted colors use the layer table, including the symbol layer.
  const value = aci === 0 ? 7 : aci === undefined || aci === 256 ? profile.layers.find(({ name }) => name === layer)?.color ?? 7 : aci;
  const index = Math.abs(value);
  const basic = ['#ffffff', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ffffff', '#808080', '#c0c0c0'];
  if (index < 10) return basic[index];
  if (index >= 250) return ['#000000', '#656565', '#666666', '#999999', '#cccccc', '#ffffff'][Math.min(index - 250, 5)];
  const hue = Math.floor((index - 10) / 10) * 15;
  const variation = (index - 10) % 10;
  const brightness = [255, 255, 165, 165, 127, 127, 76, 76, 38, 38][variation] / 255;
  const saturation = variation % 2 ? 0.5 : 1;
  const chroma = brightness * saturation;
  const secondary = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const rgb = hue < 60 ? [chroma, secondary, 0] : hue < 120 ? [secondary, chroma, 0] : hue < 180 ? [0, chroma, secondary]
    : hue < 240 ? [0, secondary, chroma] : hue < 300 ? [secondary, 0, chroma] : [chroma, 0, secondary];
  return `#${rgb.map((value) => Math.floor((value + brightness - chroma) * 255 + 1e-9).toString(16).padStart(2, '0')).join('')}`;
}
