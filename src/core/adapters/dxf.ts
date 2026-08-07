/**
 * DXFAdapter - DXF R12 规范导出
 *
 * 保持结构化：圆是圆而非线段近似。
 */

import type { CircleEntity, GeometryEntity, LineEntity, PointEntity, SpatialModel } from '../types';
import type { RepresentationAdapter } from './types';

export class DXFAdapter implements RepresentationAdapter {
  format = 'dxf';

  represent(model: SpatialModel): string {
    const lines: string[] = [];

    // HEADER 段
    lines.push('0', 'SECTION', '2', 'HEADER');
    lines.push('9', '$ACADVER', '1', 'AC1009'); // R12
    lines.push('9', '$INSUNITS', '70', '4'); // 毫米
    lines.push('0', 'ENDSEC');

    // ENTITIES 段
    lines.push('0', 'SECTION', '2', 'ENTITIES');

    for (const entity of model.entities) {
      if (!entity.visible) continue;
      const entityLines = this.representEntity(entity);
      lines.push(...entityLines);
    }

    lines.push('0', 'ENDSEC');

    // EOF
    lines.push('0', 'EOF');

    return lines.join('\n');
  }

  private representEntity(entity: GeometryEntity): string[] {
    switch (entity.type) {
      case 'point':
        return this.representPoint(entity);
      case 'line':
        return this.representLine(entity);
      case 'circle':
        return this.representCircle(entity);
      default:
        return [];
    }
  }

  private representPoint(entity: PointEntity): string[] {
    return [
      '0', 'POINT',
      '8', '0', // 图层
      '10', entity.x.toFixed(6), // X
      '20', entity.y.toFixed(6), // Y
      '30', '0.0', // Z
    ];
  }

  private representLine(entity: LineEntity): string[] {
    return [
      '0', 'LINE',
      '8', '0',
      '10', entity.start[0].toFixed(6), // 起点 X
      '20', entity.start[1].toFixed(6), // 起点 Y
      '30', '0.0',
      '11', entity.end[0].toFixed(6), // 终点 X
      '21', entity.end[1].toFixed(6), // 终点 Y
      '31', '0.0',
    ];
  }

  private representCircle(entity: CircleEntity): string[] {
    return [
      '0', 'CIRCLE',
      '8', '0',
      '10', entity.center[0].toFixed(6), // 圆心 X
      '20', entity.center[1].toFixed(6), // 圆心 Y
      '30', '0.0',
      '40', entity.radius.toFixed(6), // 半径
    ];
  }
}
