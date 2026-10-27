export interface Team {
  id: string;
  name: string;
  short: string;
  city: string;
  color: string;
  dark: string;
  secondary: string;
  symbol: string;
}

export const TEAMS: Team[] = [
  { id: 'lagos', name: 'Lagos Athletic', short: 'LAG', city: 'LAGOS, NIGERIA', color: '#f4d24d', dark: '#63501a', secondary: '#253d2c', symbol: 'sun' },
  { id: 'rio', name: 'Rio Rovers', short: 'RIO', city: 'RIO DE JANEIRO, BRAZIL', color: '#e87951', dark: '#883d2e', secondary: '#fff0cf', symbol: 'wave' },
  { id: 'lisbon', name: 'Lisbon Locals', short: 'LIS', city: 'LISBON, PORTUGAL', color: '#dbe7d4', dark: '#3b6c4e', secondary: '#326345', symbol: 'star' },
  { id: 'buenos', name: 'Buenos Aires FC', short: 'BAF', city: 'BUENOS AIRES, ARGENTINA', color: '#83bfe2', dark: '#326b91', secondary: '#f5f2e9', symbol: 'stripe' },
  { id: 'tokyo', name: 'Tokyo City', short: 'TOK', city: 'TOKYO, JAPAN', color: '#edb9cd', dark: '#974c71', secondary: '#45365b', symbol: 'sun' },
  { id: 'accra', name: 'Accra United', short: 'ACC', city: 'ACCRA, GHANA', color: '#e8b34e', dark: '#805026', secondary: '#a94737', symbol: 'star' },
  { id: 'marseille', name: 'Marseille Club', short: 'MAR', city: 'MARSEILLE, FRANCE', color: '#a4dcd3', dark: '#31685c', secondary: '#244d53', symbol: 'wave' },
  { id: 'seoul', name: 'Seoul Sunday', short: 'SEO', city: 'SEOUL, SOUTH KOREA', color: '#b5a6e2', dark: '#5b4782', secondary: '#f2ecdc', symbol: 'stripe' },
];

export const getTeam = (id: string): Team => TEAMS.find((team) => team.id === id) ?? TEAMS[0];
