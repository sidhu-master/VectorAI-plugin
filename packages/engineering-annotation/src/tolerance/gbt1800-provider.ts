// SPDX-License-Identifier: Apache-2.0

import { canonicalRuleInputDigest } from './digest';
import {
  GBT_1800_2020_COMMON_DESIGNATIONS,
  GBT_1800_2020_INTERVALS,
  GBT_1800_2020_MANIFEST,
  GBT_1800_2020_PREFERRED_DESIGNATIONS,
  type Gbt1800IntervalRecord,
} from './gbt1800-2020-data';
import type {
  FeatureOfSizeClass,
  ResolvedFit,
  ResolvedStandardTolerance,
  ToleranceBand,
  ToleranceBandCategory,
  ToleranceStandardProvider,
} from './standard-types';

const CATALOG: Readonly<Record<FeatureOfSizeClass, readonly string[]>> = {
  internal: collectDesignations('internal'),
  external: collectDesignations('external'),
};

export function createGbt1800Provider(): ToleranceStandardProvider {
  const standardRef = {
    id: GBT_1800_2020_MANIFEST.standardId,
    edition: GBT_1800_2020_MANIFEST.edition,
  } as const;

  return {
    standardRef,
    listBands({ basicSize, featureClass }) {
      const interval = findInterval(basicSize);
      return CATALOG[featureClass].map((designation): ToleranceBand => {
        const available = interval[featureClass][designation] !== undefined;
        return {
          designation,
          featureClass,
          category: categoryOf(featureClass, designation),
          available,
          ...(available ? {} : { unavailableCode: 'TOLERANCE_STANDARD_UNAVAILABLE' as const }),
        };
      });
    },
    resolveBand(request) {
      const interval = findInterval(request.basicSize);
      validateDesignation(request.featureClass, request.designation);
      const deviations = interval[request.featureClass][request.designation];
      if (deviations === undefined) throw new Error('TOLERANCE_STANDARD_UNAVAILABLE');
      return resolveTolerance(request, deviations, standardRef);
    },
    resolveFit({ basicSize, basis, designation }) {
      const parts = designation.split('/');
      if (parts.length !== 2 || parts.some((part) => part.length === 0)) {
        throw new Error('TOLERANCE_DESIGNATION_INVALID');
      }
      const hole = this.resolveBand({ basicSize, featureClass: 'internal', designation: parts[0]! });
      const shaft = this.resolveBand({ basicSize, featureClass: 'external', designation: parts[1]! });
      const minimumClearance = roundMillimetres(hole.lowerLimitSize - shaft.upperLimitSize);
      const maximumClearance = roundMillimetres(hole.upperLimitSize - shaft.lowerLimitSize);
      return {
        designation,
        basis,
        hole,
        shaft,
        fitType: minimumClearance >= 0
          ? 'clearance'
          : maximumClearance <= 0
            ? 'interference'
            : 'transition',
        minimumClearance,
        maximumClearance,
      };
    },
  };
}

function collectDesignations(featureClass: FeatureOfSizeClass): readonly string[] {
  return [...new Set(GBT_1800_2020_INTERVALS.flatMap((interval) => Object.keys(interval[featureClass])))].sort(compareText);
}

function findInterval(basicSize: number): Gbt1800IntervalRecord {
  if (!Number.isFinite(basicSize)
    || basicSize <= GBT_1800_2020_MANIFEST.minimumExclusive
    || basicSize > GBT_1800_2020_MANIFEST.maximumInclusive) {
    throw new Error('TOLERANCE_SIZE_RANGE_UNSUPPORTED');
  }
  const interval = GBT_1800_2020_INTERVALS.find(({ over, through }) => basicSize > over && basicSize <= through);
  if (interval === undefined) throw new Error('TOLERANCE_SIZE_RANGE_UNSUPPORTED');
  return interval;
}

function validateDesignation(featureClass: FeatureOfSizeClass, designation: string): void {
  if (!CATALOG[featureClass].includes(designation)) throw new Error('TOLERANCE_DESIGNATION_INVALID');
}

function resolveTolerance(
  request: { basicSize: number; featureClass: FeatureOfSizeClass; designation: string },
  [lowerMicrometres, upperMicrometres]: readonly [number, number],
  standardRef: { id: string; edition: string },
): ResolvedStandardTolerance {
  const lowerDeviation = lowerMicrometres / 1000;
  const upperDeviation = upperMicrometres / 1000;
  return {
    ...request,
    unit: 'mm',
    lowerDeviation,
    upperDeviation,
    lowerLimitSize: roundMillimetres(request.basicSize + lowerDeviation),
    upperLimitSize: roundMillimetres(request.basicSize + upperDeviation),
    standardRef,
    ruleRef: {
      id: GBT_1800_2020_MANIFEST.standardId,
      version: GBT_1800_2020_MANIFEST.datasetVersion,
      inputDigest: canonicalRuleInputDigest({
        nominalValue: request.basicSize,
        unit: 'mm',
        inputs: {
          standardId: GBT_1800_2020_MANIFEST.standardId,
          edition: GBT_1800_2020_MANIFEST.edition,
          featureClass: request.featureClass,
          designation: request.designation,
        },
      }),
    },
  };
}

function categoryOf(featureClass: FeatureOfSizeClass, designation: string): ToleranceBandCategory {
  if (GBT_1800_2020_PREFERRED_DESIGNATIONS[featureClass].includes(designation)) return 'preferred';
  if (GBT_1800_2020_COMMON_DESIGNATIONS[featureClass].includes(designation)) return 'common';
  return 'other';
}

function roundMillimetres(value: number): number {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}

function compareText(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}
