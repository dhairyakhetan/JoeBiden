// Small text helpers.
export const pad2 = (n) => String(n).padStart(2, '0'); // 3 → "03" (card numbers, counts, scores)
export const firstName = (name) => name.split(' ')[0];
export const instagramUrl = (handle) => `https://www.instagram.com/${handle}/`;
export const teamsOf = (m) => [].concat(m.team); // every team a member is in (data: team: 'writing' or ['design', 'writing'])
