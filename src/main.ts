import './style.css';
import { Store } from './ui/store.ts';
import { applyUrl, initUrlSync } from './ui/urlState.ts';
import { buildHero, buildWhy, buildTradeoffs, buildRealWorld, buildProtocolFidelity, buildCaveats } from './ui/content.ts';
import { buildStepper } from './ui/stepper.ts';
import { buildKemPanel } from './ui/kemPanel.ts';
import { buildSigPanel } from './ui/sigPanel.ts';
import { buildSecurityModel } from './ui/securityModel.ts';

const app = document.getElementById('app');
if (!app) throw new Error('#app mount point missing');

const store = new Store();
applyUrl(store); // hydrate shared state from the query string before building
initUrlSync(store); // keep the URL in sync as state changes

// Order: motivate (why) → optional guided tour → see the cost (KEM) → flip the
// switches (security model, sandwiched between the two live panels) → see it
// again for signatures → weigh it (trade-offs) → lab-vs-real → ground it (real
// world) → honest scope.
app.append(
  buildHero(),
  buildStepper(store),
  buildWhy(),
  buildKemPanel(store),
  buildSecurityModel(store),
  buildSigPanel(store),
  buildTradeoffs(),
  buildProtocolFidelity(),
  buildRealWorld(),
  buildCaveats(),
);
