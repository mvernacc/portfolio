/** Author-chosen coupled paths on one compute cohort, not fitted forecasts. */
export const TRAJECTORIES = [
  { id: 'adaptation', label: 'Adaptation on existing hardware', priceAnnualErosion: .30, throughputAnnualChange: .20, description: 'Partial capture of software and model gains; migration toward more capable services and customer retention slow realized repricing.' },
  { id: 'repricing', label: 'Faster repricing, strong adaptation', priceAnnualErosion: .60, throughputAnnualChange: .50, description: 'Competitive price cuts outpace substantial software and model gains on existing hardware.' },
  { id: 'obsolescence', label: 'Rapid obsolescence (stress case)', priceAnnualErosion: .90, throughputAnnualChange: .50, description: 'Market price pressure far outruns the installed hardware cohort’s capacity gains.' },
] as const;
export type Trajectory = typeof TRAJECTORIES[number];
export const DEFAULT_TRAJECTORY = TRAJECTORIES[0];
export function trajectoryFor(id: string): Trajectory {
  const trajectory = TRAJECTORIES.find(t => t.id === id);
  if (!trajectory) throw new Error(`Unknown trajectory: ${id}`);
  return trajectory;
}
export function trajectoryRates(t: Trajectory) {
  return { priceAnnualErosion: t.priceAnnualErosion, throughputAnnualChange: t.throughputAnnualChange };
}
