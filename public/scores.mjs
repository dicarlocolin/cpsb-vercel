function numericScore(value) {
  if (value == null || String(value).trim() === '') return NaN;
  const score = Number(value);
  return Number.isFinite(score) ? score : NaN;
}

export function teamScores(team) {
  return {
    Score: numericScore(team?.total),
    CCSScore: numericScore(team?.ccs_score),
    NetAcadQuiz: numericScore(team?.score_1),
    NetAcadPT: numericScore(team?.score_2)
  };
}

// Existing Score formulas referred to CCS; keep their results on upgrade.
export function migrateScoreConfig(config) {
  if (config.scoreVersion === 1) return config;
  return {
    ...config,
    scoreVersion: 1,
    columns: [...new Set(config.columns.flatMap(key => key === 'Score' ? ['Score', 'CCSScore'] : [key]))],
    formulas: config.formulas.replace(/\bScore\b/g, 'CCSScore')
  };
}
