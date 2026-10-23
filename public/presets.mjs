export function applyPreset(url, storage, history) {
  if (url.searchParams.get('preset') !== 'lasa') return null;
  const config = {
    name: 'LASA CyberPatriot',
    teams: [
      '19-3340, virus.exe',
      '19-1119, rm -rf /',
      `19-3341, under 5'4"`,
      '19-3342, iNc0gnITo mOd3!',
      '19-1120, Mango Company',
      '19-1121, Goodbye World',
      '19-1122, ABOVE all',
      '19-1123, cisCOPE',
      '19-1033, cache me if you can',
      '19-3343, Team A',
      '19-1034, The Other Cavaliers',
      '19-1035, The Amateurs',
      '19-1036, <404RiceNotFound>',
      '19-1037, Team C'
    ].join('\n'),
    format: 'HH:MM:SS',
    localTimes: true,
    refreshSeconds: 30,
    columns: ['Pos', 'Overall', 'TeamID', 'TeamName', 'Score', 'TimeSeconds', 'Active', 'VulnsFound', 'VulnsRemaining', 'Warnings', 'PPM', 'PPH'],
    formulas: 'PPM = Score / TimeMinutes\nPPH = Score / TimeHours'
  };
  try { storage?.setItem('cypat-config', JSON.stringify(config)); } catch {}
  url.searchParams.delete('preset');
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  return config;
}
