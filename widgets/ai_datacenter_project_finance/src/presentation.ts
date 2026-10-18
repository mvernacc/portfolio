import { THROUGHPUT_VIEW, type Control } from './config.ts';

/** Plot coordinates and physical bounds share one policy, independent of slider
 * positioning. Include out-of-range selections without changing sampling ranges.
 */
export function sensitivityAxis(control: Control, selected: number) {
  const { plausible, min, max } = control;
  const type = control.key === 'throughput' ? 'linear' : control.log ? 'log' : 'linear';
  const transform = (value: number) => type === 'log' ? Math.log10(value) : value;
  const inverse = (value: number) => type === 'log' ? 10 ** value : value;
  const [low, high] = control.key === 'throughput'
    ? [Math.max(min, plausible[1] * THROUGHPUT_VIEW.lowerBenchmarkFraction), Math.min(max, plausible[1] * THROUGHPUT_VIEW.upperBenchmarkFraction)]
    : plausible[0] === plausible[1] ? [min, max] : plausible;
  const start = transform(Math.min(low, selected));
  const end = transform(Math.max(high, selected));
  const padding = (end - start) * .04;
  const range = [Math.max(transform(min), start - padding), Math.min(transform(max), end + padding)];
  return { type, range, bounds: range.map(inverse) };
}
