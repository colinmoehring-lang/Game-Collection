import type { MetrovillePlayer, MetrovilleState } from './types.js';
import { METROVILLE_FIELDS } from './board.js';

export function addToCityParkJackpot(state: MetrovilleState, amount: number): number {
  if (!state.config.mechanics.cityParkJackpot || amount <= 0) return 0;
  const accepted = Math.min(amount, Math.max(0, state.config.cityParkJackpotCap - state.cityParkJackpot));
  state.cityParkJackpot += accepted;
  if (accepted > 0) {
    state.log.push(`${accepted} Taler fließen in den Stadtpark-Jackpot (${state.cityParkJackpot} Taler).`);
  }
  return accepted;
}

export function grantGoSalary(state: MetrovilleState, player: MetrovillePlayer) {
  player.money += state.config.goPassSalary;
  state.log.push(`🏙️ ${player.name} passiert das Stadttor und kassiert ${state.config.goPassSalary} Taler.`);
}

export function getPlayerWealth(state: MetrovilleState, player: MetrovillePlayer): number {
  const propertyValue = Object.entries(state.properties).reduce((total, [index, property]) => {
    if (property.ownerId !== player.id) return total;
    const field = METROVILLE_FIELDS[Number(index)];
    if (!field?.cost) return total;
    const mortgageDebt = property.isMortgaged ? Math.round(field.cost * 0.5) : 0;
    const buildingValue = property.houses * Math.floor((field.houseCost || 0) / 2);
    return total + field.cost - mortgageDebt + buildingValue;
  }, 0);
  return player.money + propertyValue;
}

export function grantGoPassSalary(state: MetrovilleState, player: MetrovillePlayer) {
  const activePlayers = state.players.filter(candidate => !candidate.bankrupt);
  const wealthById = new Map(activePlayers.map(candidate => [candidate.id, getPlayerWealth(state, candidate)]));
  const wealth = wealthById.get(player.id);
  const sortedWealth = [...wealthById.values()].sort((left, right) => left - right);
  const receivesBonus = state.config.mechanics.lowestWealthBonus
    && wealth !== undefined
    && activePlayers.length >= 2
    && sortedWealth[0] === wealth
    && sortedWealth[0] !== sortedWealth[1]
    && wealth !== sortedWealth[sortedWealth.length - 1];
  grantGoSalary(state, player);
  if (!receivesBonus) return;
  player.money += state.config.lowestWealthBonusAmount;
  state.log.push(`${player.name} erhält ${state.config.lowestWealthBonusAmount} Taler aus dem Förderprogramm.`);
}
