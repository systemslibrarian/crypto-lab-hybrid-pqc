import './style.css';
import { Store } from './ui/store.ts';
import { buildHero, buildWhy, buildTradeoffs, buildRealWorld } from './ui/content.ts';
import { buildKemPanel } from './ui/kemPanel.ts';
import { buildSigPanel } from './ui/sigPanel.ts';
import { buildSecurityModel } from './ui/securityModel.ts';

const app = document.getElementById('app');
if (!app) throw new Error('#app mount point missing');

const store = new Store();

// Order: motivate (why) → see the cost (KEM) → flip the switches (security
// model, sandwiched between the two live panels so both recolor) → see it again
// for signatures → weigh it (trade-offs) → ground it (real world).
app.append(
  buildHero(),
  buildWhy(),
  buildKemPanel(store),
  buildSecurityModel(store),
  buildSigPanel(store),
  buildTradeoffs(),
  buildRealWorld(),
);
