import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { runCreativeRegionEditBenchmark } from '../api/services/drawing-benchmark/region-edit.js';

const report = await runCreativeRegionEditBenchmark();
const outputDirectory = resolve('.local/vectorai/baselines/region-hair-edit');
await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
