export const CREATOR_SOURCES = [
  {
    handle: '@roadtoaesthetics',
    label: 'Road to Aesthetics',
    platform: 'TikTok',
    url: 'https://www.tiktok.com/@roadtoaesthetics',
    angle: 'high-protein comfort meals and viral macro ratings'
  },
  {
    handle: '@noahperlofit',
    label: 'Noah Perlo Fit',
    platform: 'TikTok',
    url: 'https://www.tiktok.com/@noahperlofit',
    angle: 'fitness meal prep, calorie control, and simple proteins'
  },
  {
    handle: '@fairfiteats',
    label: 'Fair Fit Eats',
    platform: 'TikTok',
    url: 'https://www.tiktok.com/@fairfiteats',
    angle: 'lean everyday meals with approachable ingredients'
  },
  {
    handle: '@nickazfit',
    label: 'Nick Az Fit',
    platform: 'TikTok',
    url: 'https://www.tiktok.com/@nickazfit',
    angle: 'high-protein recipes and cut-friendly food swaps'
  }
];

export const SOURCE_POLICY_NOTES = [
  'Creator handles are used as public discovery seeds and attribution links, not as copied recipes.',
  'For production, save the discovered URL for each recipe idea and verify reuse rights before publishing creator-specific content.',
  'Macros are estimates for planning and should be checked against exact ingredient brands and portion sizes.'
];

export function getSourceSeeds(selectedHandles = []) {
  const wanted = new Set(selectedHandles.map((value) => value.toLowerCase()));
  if (wanted.size === 0) return [];

  const selected = CREATOR_SOURCES.filter(
    (source) => wanted.has(source.handle.toLowerCase())
  );

  return selected;
}

export function buildSearchQueries({ protein, mealType, sourceHandles = [] }) {
  const sources = getSourceSeeds(sourceHandles);
  const core = `${protein} ${mealType} high protein low calorie recipe macros`;

  return [
    core,
    ...sources.slice(0, 2).map((source) => `${source.handle} ${core}`)
  ];
}
