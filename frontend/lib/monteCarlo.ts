export interface MonteCarloPath {
  days: number[];
  values: number[];
  profitable: boolean;
}

export interface MonteCarloResult {
  paths: MonteCarloPath[];
  p95_impairment: number;
  p99_impairment: number;
  spot_price: number;
}

const ASSET_PRICES: Record<string, number> = {
  SOL: 145,
  ETH: 3200,
};

// Seeded RNG for reproducibility
export class SeededRandom {
  private seed: number;
  constructor(seed: number = 42) {
    this.seed = seed;
  }
  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
  normal(): number {
    // Box-Muller transform
    let u1 = this.next();
    let u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
  }
}

export function runMonteCarlo(
  asset: string,
  net_carry_apy: number,
  days: number = 30,
  numPaths: number = 20,
  seed: number = 42
): MonteCarloResult {
  const rng = new SeededRandom(seed);
  const spot = ASSET_PRICES[asset] ?? 145;
  const dt = 1 / 365;
  const mu = net_carry_apy / 100;
  const sigma = 0.03;

  let paths: MonteCarloPath[] = [];

  for (let p = 0; p < numPaths; p++) {
    let values: number[] = [spot];
    let s = spot;

    for (let d = 1; d <= days; d++) {
      let Z = rng.normal();
      s = s * Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * Z);
      values.push(s);
    }

    let final = values[values.length - 1];
    paths.push({
      days: Array.from({ length: days + 1 }, (_, i) => i),
      values,
      profitable: final >= spot,
    });
  }

  // Calculate impairment levels
  let impairments = paths.map(p => (spot - p.values[p.values.length - 1]) / spot).sort((a, b) => a - b);
  let p95 = impairments[Math.floor(impairments.length * 0.95)] ?? 0;
  let p99 = impairments[Math.floor(impairments.length * 0.99)] ?? 0;

  return { paths, p95_impairment: Math.round(p95 * 1000) / 10, p99_impairment: Math.round(p99 * 1000) / 10, spot_price: spot };
}
