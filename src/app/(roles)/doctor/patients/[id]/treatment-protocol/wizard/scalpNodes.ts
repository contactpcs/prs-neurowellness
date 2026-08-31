// Standard 10-20 EEG electrode system layout (percentage coordinates on a
// circular head map) — a fixed, universal reference layout, not per-patient
// data. Used to place the real anode_site/cathode_site strings the backend
// returns (e.g. "F3", "Fp2") onto the visual map.
export const SCALP_NODES: [string, number, number][] = [
  ["Fp1", 37, 13], ["Fp2", 63, 13],
  ["F7", 17, 27], ["F3", 34.5, 29], ["Fz", 50, 29], ["F4", 65.5, 29], ["F8", 83, 27],
  ["A1", 2.5, 50], ["T3", 13, 50], ["C3", 31.5, 50], ["Cz", 50, 50], ["C4", 68.5, 50], ["T4", 87, 50], ["A2", 97.5, 50],
  ["T5", 17, 73], ["P3", 34.5, 71], ["Pz", 50, 71], ["P4", 65.5, 71], ["T6", 83, 73],
  ["O1", 37, 87], ["O2", 63, 87],
];
