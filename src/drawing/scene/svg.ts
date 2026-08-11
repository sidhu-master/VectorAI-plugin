import type { Vec2 } from '../document/types';
import type { ScenePathCommand } from './types';

const FULL_TURN = Math.PI * 2;
const EPSILON = 1e-10;

export function scenePathData(commands: readonly ScenePathCommand[]): string {
  const output: string[] = [];
  for (const command of commands) {
    switch (command.op) {
      case 'M':
      case 'L':
        output.push(`${command.op} ${point(command.point)}`);
        break;
      case 'Q':
        output.push(`Q ${point(command.control)} ${point(command.end)}`);
        break;
      case 'A':
        output.push(...arcSegments(command));
        break;
      case 'Z':
        output.push('Z');
        break;
    }
  }
  return output.join(' ');
}

function arcSegments(command: Extract<ScenePathCommand, { op: 'A' }>): string[] {
  const rawDelta = command.endAngle - command.startAngle;
  const full = Math.abs(rawDelta) >= FULL_TURN - EPSILON;
  const span = full
    ? command.counterClockwise ? FULL_TURN : -FULL_TURN
    : signedSweep(command.startAngle, command.endAngle, command.counterClockwise);
  const segments = full ? 2 : 1;
  const output: string[] = [];
  for (let index = 1; index <= segments; index += 1) {
    const segmentSpan = span / segments;
    const end = command.startAngle + segmentSpan * index;
    const endpoint = pointOnEllipse(command, end);
    output.push([
      'A',
      number(command.radiusX),
      number(command.radiusY),
      number(command.rotation * 180 / Math.PI),
      Math.abs(segmentSpan) > Math.PI + EPSILON ? '1' : '0',
      command.counterClockwise ? '1' : '0',
      point(endpoint),
    ].join(' '));
  }
  return output;
}

function signedSweep(start: number, end: number, counterClockwise: boolean): number {
  return counterClockwise
    ? normalizePositive(end - start, FULL_TURN)
    : -normalizePositive(start - end, FULL_TURN);
}

function pointOnEllipse(
  command: Extract<ScenePathCommand, { op: 'A' }>,
  parameter: number,
): Vec2 {
  const cosRotation = Math.cos(command.rotation);
  const sinRotation = Math.sin(command.rotation);
  const x = command.radiusX * Math.cos(parameter);
  const y = command.radiusY * Math.sin(parameter);
  return [
    command.center[0] + x * cosRotation - y * sinRotation,
    command.center[1] + x * sinRotation + y * cosRotation,
  ];
}

function point(value: Vec2): string {
  return `${number(value[0])} ${number(value[1])}`;
}

function number(value: number): string {
  const cleaned = Math.abs(value) <= EPSILON ? 0 : Math.round(value * 1e9) / 1e9;
  return String(cleaned);
}

function normalizePositive(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}
