/**
 * Acoustic Ocean Intelligence Utility Module (TypeScript Type Definitions)
 * Subsurface sound-speed structure and Sonic Layer Depth (SLD) estimation
 */

export interface AcousticAnalysisResult {
  estimatedSoundSpeedMpsByDepth: (number | null)[];
  estimatedSalinityPsuByDepth: (number | null)[];
  estimatedSonicLayerDepthM: number | null;
  acousticFlags: string[];
  acousticConfidence: number;
  confidenceLabel: string;
  salinitySource: string;
  status: 'local_maximum_detected' | 'deepening_beyond_resolved_layer' | 'no_resolved_surface_duct' | 'insufficient_profile_data';
  interpretation: string;
}

export declare function computeSoundSpeed(T: number, S: number, z: number): number | null;
export declare function estimateVerticalSalinity(S_surface?: number, depths?: number[]): number[];
export declare function detectSonicLayerDepth(soundSpeeds: number[], depths?: number[]): { sld: number | null; status: string; flag: string };
export declare function computeAcousticConfidence(upperUncertainties: number[] | null, isRealSSS?: boolean, isFallbackSSS?: boolean): { confidence: number; label: string; flags: string[] };
export declare function analyzeColumnAcoustics(temperatures: number[], uncertainties?: number[] | null, surfaceSalinity?: number | null, datasetName?: string | null): AcousticAnalysisResult;
