export const EnvironmentKey = {
  Nextflow: 'nextflow'
} as const;

export type EnvironmentKey = (typeof EnvironmentKey)[keyof typeof EnvironmentKey];
