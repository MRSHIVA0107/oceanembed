/**
 * Acoustic Ocean Intelligence Utility Module
 * Subsurface sound-speed structure and Sonic Layer Depth (SLD) estimation
 * Derived from OceanEmbed reconstructed temperatures and surface-constrained salinity.
 *
 * SCIENTIFIC CAVEAT:
 * Research-grade estimate derived from reconstructed temperature, surface-constrained
 * or climatological salinity, and depth-derived pressure. It is not a tactical sonar-performance
 * or detection product.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.AcousticIntelligence = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Standard depths in meters
  const FULL_DEPTHS_M = [0, 50, 100, 200, 500, 1000];
  const ACOUSTIC_DEPTHS_M = [0, 50, 100, 200];

  // Bay-of-Bengal climatological salinity profile (PSU)
  const S_CLIM_M = [34.5, 34.7, 34.8, 34.9, 34.95, 34.95];

  // Anomaly vertical decay scale (meters)
  const Z_SCALE_M = 75.0;

  /**
   * Simplified transparent empirical sound-speed approximation:
   * c(T, S, z) = 1449.2 + 4.6*T - 0.055*T^2 + 0.00029*T^3 + (1.34 - 0.010*T)*(S - 35) + 0.016*z
   *
   * @param {number} T - Temperature in degrees Celsius
   * @param {number} S - Salinity in PSU
   * @param {number} z - Depth in meters
   * @returns {number|null} Speed of sound in m/s
   */
  function computeSoundSpeed(T, S, z) {
    if (T == null || isNaN(T) || !isFinite(T)) return null;
    if (S == null || isNaN(S) || !isFinite(S)) return null;
    const c =
      1449.2 +
      4.6 * T -
      0.055 * T * T +
      0.00029 * T * T * T +
      (1.34 - 0.01 * T) * (S - 35.0) +
      0.016 * z;
    return parseFloat(c.toFixed(2));
  }

  /**
   * Vertical salinity estimation with climatology-constrained exponential anomaly decay:
   * S_hat(z) = S_clim(z) + (S_surface - S_clim(0)) * exp(-z / zScale)
   *
   * @param {number} S_surface - Surface salinity in PSU (defaults to 34.5 PSU fallback)
   * @param {number[]} [depths] - Depths array (defaults to [0, 50, 100, 200])
   * @returns {number[]} Array of salinity values in PSU
   */
  function estimateVerticalSalinity(S_surface = 34.5, depths = ACOUSTIC_DEPTHS_M) {
    const s0_clim = S_CLIM_M[0]; // 34.5
    return depths.map((z, idx) => {
      const climZ = S_CLIM_M[idx] != null ? S_CLIM_M[idx] : 34.9;
      const sHat = climZ + (S_surface - s0_clim) * Math.exp(-z / Z_SCALE_M);
      return parseFloat(sHat.toFixed(2));
    });
  }

  /**
   * Evaluates Sonic Layer Depth (SLD) on upper-ocean depths [0, 50, 100, 200] m.
   *
   * Candidate indices for local maximum: k=1 (50m) and k=2 (100m)
   * Condition: c[k] >= c[k-1] AND c[k] > c[k+1]
   *
   * @param {number[]} soundSpeeds - [c(0), c(50), c(100), c(200)] in m/s
   * @param {number[]} depths - [0, 50, 100, 200] in meters
   * @returns {{ sld: number|null, status: string, flag: string }}
   */
  function detectSonicLayerDepth(soundSpeeds, depths = ACOUSTIC_DEPTHS_M) {
    if (
      !soundSpeeds ||
      soundSpeeds.length < 4 ||
      soundSpeeds.some((v) => v == null || isNaN(v) || !isFinite(v))
    ) {
      return {
        sld: null,
        status: "insufficient_profile_data",
        flag: "Insufficient upper-ocean profile data."
      };
    }

    // Rule 1: Shallowest local maximum at internal candidate indices (50m, 100m)
    for (let k = 1; k <= 2; k++) {
      if (soundSpeeds[k] >= soundSpeeds[k - 1] && soundSpeeds[k] > soundSpeeds[k + 1]) {
        return {
          sld: depths[k],
          status: "local_maximum_detected",
          flag: `Near-surface sound-speed maximum estimated at ${depths[k]} m.`
        };
      }
    }

    // Rule 2: Monotonically increasing from 0 to 200 m
    if (
      soundSpeeds[0] < soundSpeeds[1] &&
      soundSpeeds[1] < soundSpeeds[2] &&
      soundSpeeds[2] < soundSpeeds[3]
    ) {
      return {
        sld: 200,
        status: "deepening_beyond_resolved_layer",
        flag: "SLD may be deeper than the 200 m acoustic-analysis window."
      };
    }

    // Rule 3: Sound speed decreases from surface downward or no local maximum resolved
    return {
      sld: null,
      status: "no_resolved_surface_duct",
      flag: "No resolved near-surface sound-speed maximum at available vertical resolution."
    };
  }

  /**
   * Transparent heuristic confidence score strictly for UI communication (not calibrated probability):
   * acousticConfidence = clamp(0.50 * tempConf + 0.30 * salConf + 0.20 * vertConf, 0, 1)
   *
   * @param {number[]|null} upperUncertainties - Epistemic uncertainties for upper 0-200m [°C]
   * @param {boolean} isRealSSS - Whether genuine SSS product was available
   * @param {boolean} isFallbackSSS - Whether fixed fallback (34.5 PSU) was used
   * @returns {{ confidence: number, label: string, flags: string[] }}
   */
  function computeAcousticConfidence(upperUncertainties, isRealSSS = false, isFallbackSSS = true) {
    const flags = [];
    let tempConf = 0.55;

    if (upperUncertainties && upperUncertainties.length >= 4) {
      const valid = upperUncertainties.slice(0, 4).filter((u) => u != null && isFinite(u));
      if (valid.length === 4) {
        const meanU = valid.reduce((a, b) => a + b, 0) / 4.0;
        // Typical model epistemic uncertainty ranges 0.0 to 0.40 °C
        const normU = Math.max(0, Math.min(1, meanU / 0.40));
        tempConf = 1.0 - normU;
      } else {
        flags.push("Partial epistemic uncertainty data; using baseline confidence.");
      }
    } else {
      flags.push("Epistemic uncertainty unavailable; using baseline temperature confidence.");
    }

    const salConf = isRealSSS ? 0.8 : isFallbackSSS ? 0.55 : 0.35;
    const vertConf = 0.55; // Six coarse reconstructed levels

    const raw = 0.5 * tempConf + 0.3 * salConf + 0.2 * vertConf;
    const confidence = parseFloat(Math.max(0, Math.min(1, raw)).toFixed(3));

    let label = "Exploratory — interpret cautiously";
    if (confidence >= 0.75) {
      label = "High — research estimate";
    } else if (confidence >= 0.5) {
      label = "Moderate — research estimate";
    }

    return { confidence, label, flags };
  }

  /**
   * Comprehensive Acoustic Analysis for a single ocean profile.
   *
   * @param {number[]} temperatures - Reconstructed temperature profile (at least upper 4 levels [0, 50, 100, 200] m)
   * @param {number[]|null} [uncertainties] - Epistemic uncertainty profile
   * @param {number|null} [surfaceSalinity] - S_surface in PSU (optional)
   * @param {string|null} [datasetName] - SSS dataset name if available
   * @returns {Object} Acoustic intelligence parameters per specification
   */
  function analyzeColumnAcoustics(
    temperatures,
    uncertainties = null,
    surfaceSalinity = null,
    datasetName = null
  ) {
    const flags = [];
    const isRealSSS = Boolean(datasetName && surfaceSalinity != null);
    const S_surface = surfaceSalinity != null ? surfaceSalinity : 34.5;
    const salinitySource = isRealSSS
      ? `Salinity source: ${datasetName} surface-constrained estimate`
      : "Salinity source: climatological fallback / surface-constrained estimate";

    if (
      !temperatures ||
      temperatures.length < 4 ||
      temperatures.slice(0, 4).some((t) => t == null || isNaN(t) || t <= -1.0)
    ) {
      return {
        estimatedSoundSpeedMpsByDepth: [null, null, null, null],
        estimatedSalinityPsuByDepth: [null, null, null, null],
        estimatedSonicLayerDepthM: null,
        acousticFlags: ["Insufficient upper-ocean profile data."],
        acousticConfidence: 0.35,
        confidenceLabel: "Exploratory — interpret cautiously",
        salinitySource,
        status: "insufficient_profile_data",
        interpretation: "Insufficient upper-ocean profile data to estimate acoustic structure."
      };
    }

    const estimatedSalinityPsuByDepth = estimateVerticalSalinity(S_surface, ACOUSTIC_DEPTHS_M);
    const estimatedSoundSpeedMpsByDepth = ACOUSTIC_DEPTHS_M.map((z, k) =>
      computeSoundSpeed(temperatures[k], estimatedSalinityPsuByDepth[k], z)
    );

    const sldResult = detectSonicLayerDepth(estimatedSoundSpeedMpsByDepth, ACOUSTIC_DEPTHS_M);
    flags.push(sldResult.flag);

    const confResult = computeAcousticConfidence(
      uncertainties,
      isRealSSS,
      surfaceSalinity == null
    );
    flags.push(...confResult.flags);

    let interpretation;
    if (sldResult.status === "local_maximum_detected") {
      interpretation = `A near-surface sound-speed maximum is estimated at ${sldResult.sld} m from the available coarse-depth profile.`;
    } else if (sldResult.status === "deepening_beyond_resolved_layer") {
      interpretation =
        "Sound speed increases monotonically through 200 m; any acoustic maximum lies deeper than the 200 m resolved window.";
    } else {
      interpretation =
        "No resolved near-surface sound-speed maximum is visible in the available 0–200 m profile.";
    }

    return {
      estimatedSoundSpeedMpsByDepth,
      estimatedSalinityPsuByDepth,
      estimatedSonicLayerDepthM: sldResult.sld,
      acousticFlags: flags,
      acousticConfidence: confResult.confidence,
      confidenceLabel: confResult.label,
      salinitySource,
      status: sldResult.status,
      interpretation
    };
  }

  return {
    FULL_DEPTHS_M,
    ACOUSTIC_DEPTHS_M,
    S_CLIM_M,
    Z_SCALE_M,
    computeSoundSpeed,
    estimateVerticalSalinity,
    detectSonicLayerDepth,
    computeAcousticConfidence,
    analyzeColumnAcoustics
  };
});
