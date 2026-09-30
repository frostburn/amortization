import type { Mission } from '../sim/types';

interface MissionCopy {
  briefing: { objective: string; extract: string; rules: string };
  epilogue: { lead: string; body: string };
}

// Keep each contract's concise orders and ending together. Presentation copy
// stays outside recorded mission definitions, so prose edits do not invalidate
// replays. Endings must hold for any successful route and surviving crew.
export const missionCopy: Record<Mission['id'], MissionCopy> = {
  depot: {
    briefing: {
      objective: 'Recruit engineer Iona Voss from the secure office.',
      extract: 'Bring Voss and every surviving operative to VAN.',
      rules: 'One maintenance disguise is available for the four-person crew.',
    },
    epilogue: {
      lead: 'Iona Voss is free.',
      body: 'Voss writes down the address of the records annex. Somewhere inside is the original ledger behind the contracts that kept her at the depot.',
    },
  },
  archive: {
    briefing: {
      objective: 'Recover the original LEDGER from the records annex.',
      extract: 'Bring the ledger and every survivor to the east-road VAN.',
      rules: 'The ledger occupies both hands and is conspicuous even in uniform.',
    },
    epilogue: {
      lead: 'The ledger is secured.',
      body: 'Under a desk lamp, Voss follows the same account number through page after page. Payments for the district all lead to one escrow account.',
    },
  },
  transfer: {
    briefing: {
      objective: 'Recover the security courier’s CASE of account keys.',
      extract: 'Bring CASE and every survivor to the west-street VAN.',
      rules: 'The courier waits for CALL. There is no transfer countdown before you request it.',
    },
    epilogue: {
      lead: 'The access keys are secured.',
      body: 'Voss uses the keys to open the escrow records. The objections all bear the same auditor’s name: Mara Quill, now held at the remand station.',
    },
  },
  custody: {
    briefing: {
      objective: 'Free auditor Mara Quill from the locked security transport.',
      extract: 'Bring Mara and every survivor to STREET or SERVICE.',
      rules: 'Mara is unarmed, slow and vulnerable once she leaves the transport.',
    },
    epilogue: {
      lead: 'Mara Quill is free.',
      body: 'Mara asks for the ledger before she asks where you are taking her. By morning, she has matched its entries to the escrow transfers and begun writing her audit.',
    },
  },
  broadcast: {
    briefing: {
      objective: 'Publish Mara’s audit at UPLINK.',
      extract: 'Once the audit is public, bring every survivor to VAN.',
      rules:
        'The operator needs free hands and cannot fire while working. Upload progress survives interruptions.',
    },
    epilogue: {
      lead: 'Mara’s audit is public.',
      body: 'Acknowledgements of Mara’s audit begin arriving from addresses she does not recognise. She saves each one, then opens the inventory of the company’s debt-recovery machines.',
    },
  },
  severance: {
    briefing: {
      objective: 'Plant charges at WEST and EAST, then detonate both backups.',
      extract: 'After destroying both cores, bring every survivor to VAN.',
      rules:
        'Completed charges stay armed without a timer. Everyone must leave both marked blast areas before detonation.',
    },
    epilogue: {
      lead: 'Both backups are destroyed.',
      body: 'Neither recovery core answers Voss’s checks. Mara turns to the frozen escrow: the debts cannot be rebuilt from those machines, but the money still has to reach its owners.',
    },
  },
  clearing: {
    briefing: {
      objective: 'Recover the settlement KEYS from the north vault.',
      extract: 'Bring KEYS and every survivor to the north-east VAN.',
      rules: 'The case occupies both hands and is conspicuous even in uniform.',
    },
    epilogue: {
      lead: 'The settlement keys are secured.',
      body: 'Mara tests the settlement keys against the frozen account. The bank accepts them, then asks for the original restitution mandate before it will release a payment.',
    },
  },
  mandate: {
    briefing: {
      objective: 'Recover the restitution MANDATE from the north records room.',
      extract: 'Bring MANDATE and every survivor to the north-east VAN.',
      rules:
        'Four wired turrets guard the site. RADIO does not disable them. The mandate occupies both hands.',
    },
    epilogue: {
      lead: 'The mandate is secured.',
      body: 'Mara lays the mandate beside the settlement keys and checks every seal. For the first time, she can put names and amounts on the proposed repayments.',
    },
  },
  personnel: {
    briefing: {
      objective: 'Morrow and Sable must free Vale and Rook. The mandate stays with Mara.',
      extract: 'Free both prisoners, release EXIT, then bring all four to VAN.',
      rules:
        'Any operative’s death fails the rescue. Cell releases require a separate operative maintaining remote power.',
    },
    epilogue: {
      lead: 'All four are home.',
      body: 'At the new safehouse, Mara puts the mandate on the table. Vale and Rook sit down beside Morrow and Sable to hear what still has to be done.',
    },
  },
  injunction: {
    briefing: {
      objective: 'Serve the restitution mandate by uploading it at UPLINK.',
      extract: 'Once the mandate is served, bring every survivor to VAN.',
      rules:
        'Upload progress survives interruptions. Ivory inspectors verify uniforms. RADIO is deep inside a secure office.',
    },
    epilogue: {
      lead: 'Mandate served.',
      body: 'Mara watches the registry acknowledge service. The collection orders are suspended; she opens the list of people still waiting for their money and starts with the first name.',
    },
  },
  settlement: {
    briefing: {
      objective:
        'Recover REGISTER, reconcile it at CHECK, then operate SIGN and CLEAR together to release repayments.',
      extract: 'Bring REGISTER and every survivor to VAN after the funds clear.',
      rules:
        'Daylight extends human sight by 50%. Two operatives must survive until the transfer is complete. Its progress survives interruptions.',
    },
    epilogue: {
      lead: 'The first repayments have cleared.',
      body: 'Mara checks the first receipt against the register. An account that has carried charges for years now shows money coming in. She calls its owner.',
    },
  },
  countermand: {
    briefing: {
      objective:
        'Recover RECALL and have its carrier file it at FILE for nine uninterrupted seconds.',
      extract: 'Bring the original RECALL and every survivor to VAN after filing.',
      rules:
        'Daylight extends human sight by 50%. Carrying the original occupies both hands and attracts suspicion, even in uniform.',
    },
    epilogue: {
      lead: 'The seizure crews have been recalled.',
      body: 'Voss checks each withdrawn dispatch against the original. Mara calls the woman whose repayment arrived that morning. This time, she can tell her that the men at the door have been ordered to leave.',
    },
  },
};
