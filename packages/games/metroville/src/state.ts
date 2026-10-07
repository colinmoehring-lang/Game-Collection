import type { MetrovilleState } from './types.js';

export function remapMetrovillePlayerId(
  state: MetrovilleState,
  previousId: string,
  nextId: string
): MetrovilleState {
  const remap = (id: string) => id === previousId ? nextId : id;
  return {
    ...state,
    players: state.players.map(player => player.id === previousId ? { ...player, id: nextId } : player),
    playerOrder: state.playerOrder.map(remap),
    currentTurnPlayerId: remap(state.currentTurnPlayerId),
    lastRollerId: state.lastRollerId ? remap(state.lastRollerId) : null,
    playersActedThisRound: state.playersActedThisRound.map(remap),
    botTradeOfferRounds: Object.fromEntries(
      Object.entries(state.botTradeOfferRounds).map(([playerId, round]) => [remap(playerId), round])
    ),
    properties: Object.fromEntries(
      Object.entries(state.properties).map(([index, property]) => [
        index,
        property.ownerId === previousId ? { ...property, ownerId: nextId } : { ...property }
      ])
    ),
    leases: Object.fromEntries(
      Object.entries(state.leases).map(([index, lease]) => [
        index,
        {
          ...lease,
          ownerId: remap(lease.ownerId),
          tenantId: remap(lease.tenantId)
        }
      ])
    ),
    auction: state.auction
      ? {
          ...state.auction,
          initiatorId: remap(state.auction.initiatorId),
          highestBidderId: state.auction.highestBidderId ? remap(state.auction.highestBidderId) : null,
          activePlayerIds: state.auction.activePlayerIds.map(remap)
        }
      : null,
    pendingTrade: state.pendingTrade
      ? {
          ...state.pendingTrade,
          fromPlayerId: remap(state.pendingTrade.fromPlayerId),
          toPlayerId: remap(state.pendingTrade.toPlayerId),
          offeredPropertyIndices: [...state.pendingTrade.offeredPropertyIndices],
          offeredLeasePropertyIndices: [...(state.pendingTrade.offeredLeasePropertyIndices || [])],
          requestedPropertyIndices: [...state.pendingTrade.requestedPropertyIndices],
          requestedLeasePropertyIndices: [...(state.pendingTrade.requestedLeasePropertyIndices || [])]
        }
      : null
  };
}
