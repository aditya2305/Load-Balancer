export type Strategy = "RR" | "SIMPLE" | "CH" | "STATIC";

export interface Server {
  id: string;        // "localhost:8081"
  port: number;      // 8081
  healthy: boolean;  // not used yet, placeholder for future
}

export interface Mapping {
  [key: string]: string; // key -> server.id
}

export interface DiffRow {
  k: string;
  b?: string;
  a?: string;
  changed: boolean;
}

export interface DiffResult {
  moved: number;
  total: number;
  rows: DiffRow[];
}
