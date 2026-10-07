import type { CardDefinition, MetrovilleState } from './types.js';
import { addToCityParkJackpot, grantGoPassSalary, grantGoSalary } from './economy.js';

export const EXPRESS_CARDS: CardDefinition[] = [
  {
    id: 'exp-1',
    deck: 'chance',
    title: 'Eilzustellung zum Stadttor',
    text: 'Rücke vor bis zum Stadttor und kassiere 200 Metro-Taler.',
    action: (state, pid) => {
      const p = state.players.find(pl => pl.id === pid);
      if (p) {
        p.position = 0;
        grantGoSalary(state, p);
      }
    }
  },
  {
    id: 'exp-2',
    deck: 'chance',
    title: 'Direktflug zum Raumhafen-Boulevard',
    text: 'Rücke vor zum Raumhafen-Boulevard. Wenn du über das Stadttor kommst, ziehe 200 Taler ein.',
    action: (state, pid) => {
      const p = state.players.find(pl => pl.id === pid);
      if (p) {
        if (p.position > 37) grantGoPassSalary(state, p);
        p.position = 37;
      }
    }
  },
  {
    id: 'exp-3',
    deck: 'chance',
    title: 'Quarantäne-Sofortbefehl',
    text: 'Begib dich direkt in die Sicherheitszone. Gehe nicht über das Stadttor.',
    action: (state, pid) => {
      const p = state.players.find(pl => pl.id === pid);
      if (p) {
        p.position = 10;
        p.inJail = true;
        p.jailTurns = 0;
      }
    }
  },
  {
    id: 'exp-4',
    deck: 'chance',
    title: 'Technologie-Prämie',
    text: 'Die Ingenieursgilde belohnt deine Innovation: Erhalte 150 Metro-Taler.',
    action: (state, pid) => {
      const p = state.players.find(pl => pl.id === pid);
      if (p) p.money += 150;
    }
  },
  {
    id: 'exp-5',
    deck: 'chance',
    title: 'Magnetschwebebahn-Pass',
    text: 'Kostenlose Sonderfreigabe zur Entlassung aus der Sicherheitszone.',
    action: (state, pid) => {
      const p = state.players.find(pl => pl.id === pid);
      if (p) p.getOutOfJailCards++;
    }
  },
  {
    id: 'exp-6',
    deck: 'chance',
    title: 'Gebäudesanierungs-Abgabe',
    text: 'Zahle 25 Taler je Wohnblock und 100 Taler je Wolkenkratzer für Filteranlagen.',
    action: (state, pid) => {
      const p = state.players.find(pl => pl.id === pid);
      if (!p) return;
      let cost = 0;
      Object.entries(state.properties).forEach(([idx, prop]) => {
        if (prop.ownerId === pid) {
          if (prop.houses === 5) cost += 100;
          else cost += prop.houses * 25;
        }
      });
      p.money -= cost;
      addToCityParkJackpot(state, cost);
    }
  }
];

export const STADTRAT_CARDS: CardDefinition[] = [
  {
    id: 'stadt-1',
    deck: 'community',
    title: 'Kommunal-Dividende',
    text: 'Der Stadtrat schüttet Gewinne aus städtischen Betrieben aus. Erhalte 100 Taler.',
    action: (state, pid) => {
      const p = state.players.find(pl => pl.id === pid);
      if (p) p.money += 100;
    }
  },
  {
    id: 'stadt-2',
    deck: 'community',
    title: 'Umwelt-Stadtratsabgabe',
    text: 'Beitrag zur Luftreinhaltung der Kuppel. Zahle 50 Taler.',
    action: (state, pid) => {
      const p = state.players.find(pl => pl.id === pid);
      if (p) p.money -= 50;
    }
  },
  {
    id: 'stadt-3',
    deck: 'community',
    title: 'Stadtrats-Ehrenbürgerschaft',
    text: 'Jeder Mitspieler gratuliert mit 20 Metro-Talern.',
    action: (state, pid) => {
      const target = state.players.find(pl => pl.id === pid);
      if (!target) return;
      state.players.forEach(other => {
        if (other.id !== pid && !other.bankrupt) {
          const amount = Math.min(20, other.money);
          other.money -= amount;
          target.money += amount;
        }
      });
    }
  },
  {
    id: 'stadt-4',
    deck: 'community',
    title: 'Kostenlose Sonderfreigabe',
    text: 'Du kommst ohne Gebühr aus der Sicherheitszone frei.',
    action: (state, pid) => {
      const p = state.players.find(pl => pl.id === pid);
      if (p) p.getOutOfJailCards++;
    }
  }
];

export const ALL_CARDS_MAP: Record<string, CardDefinition> = {
  ...Object.fromEntries(EXPRESS_CARDS.map(c => [c.id, c])),
  ...Object.fromEntries(STADTRAT_CARDS.map(c => [c.id, c]))
};
