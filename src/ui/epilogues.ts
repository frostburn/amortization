import type { Mission } from '../sim/types';

// These scenes depend only on the completed contract, never on optional cargo,
// alarm status or a full-crew extraction. Keep prose out of replay fingerprints.
export const epilogues: Record<Mission['id'], { lead: string; body: string }> = {
  depot: {
    lead: 'Iona Voss is free.',
    body: 'Voss writes down the address of the records annex. Somewhere inside is the original ledger behind the contracts that kept her at the depot.',
  },
  archive: {
    lead: 'The ledger is secured.',
    body: 'Under a desk lamp, Voss follows the same account number through page after page. Payments for the district all lead to one escrow account.',
  },
  transfer: {
    lead: 'The access keys are secured.',
    body: 'Voss uses the keys to open the escrow records. The objections all bear the same auditor’s name: Mara Quill, now held at the remand station.',
  },
  custody: {
    lead: 'Mara Quill is free.',
    body: 'Mara asks for the ledger before she asks where you are taking her. By morning, she has matched its entries to the escrow transfers and begun writing her audit.',
  },
  broadcast: {
    lead: 'Mara’s audit is public.',
    body: 'Acknowledgements of Mara’s audit begin arriving from addresses she does not recognise. She saves each one, then opens the inventory of the company’s debt-recovery machines.',
  },
  severance: {
    lead: 'Both backups are destroyed.',
    body: 'Neither recovery core answers Voss’s checks. Mara turns to the frozen escrow: the debts cannot be rebuilt from those machines, but the money still has to reach its owners.',
  },
  clearing: {
    lead: 'The settlement keys are secured.',
    body: 'Mara tests the settlement keys against the frozen account. The bank accepts them, then asks for the original restitution mandate before it will release a payment.',
  },
  mandate: {
    lead: 'The mandate is secured.',
    body: 'Mara lays the mandate beside the settlement keys and checks every seal. For the first time, she can put names and amounts on the proposed repayments.',
  },
  personnel: {
    lead: 'All four are home.',
    body: 'At the new safehouse, Mara puts the mandate on the table. Vale and Rook sit down beside Morrow and Sable to hear what still has to be done.',
  },
  injunction: {
    lead: 'Mandate served.',
    body: 'Mara watches the registry acknowledge service. The collection orders are suspended; she opens the list of people still waiting for their money and starts with the first name.',
  },
};
