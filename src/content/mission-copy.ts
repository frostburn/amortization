import type { Mission } from '../sim/types';
import type { StoryScene } from './story';

interface MissionCopy {
  briefing: { objective: string; extract: string; rules: string };
  epilogue: { lead: string; body: string };
  scene: StoryScene;
}

// Keep each contract's concise orders and ending together. Presentation copy
// stays outside recorded mission definitions, so prose edits do not invalidate
// replays. Scenes use the full story cast, independently of gameplay casualties.
export const missionCopy: Record<Mission['id'], MissionCopy> = {
  bench: {
    briefing: {
      objective: 'Defeat Dacre. Open the Bench, then cuff or eliminate Severin Holt.',
      extract: 'Take UP to the rooftop HELI with every survivor, plus Holt if arrested.',
      rules:
        'Hold both seals together for four seconds, or force CUT. Dacre’s two-second command can be interrupted by a hit or flash. The helicopter waits.',
    },
    epilogue: {
      lead: 'The helicopter clears the tower.',
      body: 'Dacre’s command ends on the executive floor. Holt no longer signs for the district. Below, the exchange keeps the repayments moving and the cancelled seizure orders remain cancelled. At the safehouse, Voss has left the door open and set out glasses. For once, the crew is coming home to a celebration.',
    },
    scene: {
      title: 'Off duty',
      setting: 'safehouse',
      tone: 'celebration',
      beats: [
        {
          speaker: 'voss',
          text: 'You’re back. The whole street came out when they heard the helicopter. Come inside—there’s food, and nobody is on a clock tonight.',
        },
        { speaker: 'morrow', text: 'Stand down. Weapons safe. We made it home.' },
        {
          speaker: 'vale',
          text: 'I checked the repayments on the way down. They’re still there. And for once, I’m shutting this thing off.',
        },
        {
          speaker: 'rook',
          text: 'Then give me that bottle. I’ve been carrying enough equipment for one night.',
        },
        {
          speaker: 'sable',
          text: 'You should see the tower from here. All that height, and it can’t tell a single one of us where to go.',
        },
        {
          speaker: 'quill',
          text: 'No one upstairs is giving orders anymore. Tomorrow, the hearings begin. Tonight belongs to the people who got us here.',
        },
        {
          speaker: 'voss',
          text: 'Tomorrow can wait. I saved these glasses for something worth celebrating.',
        },
        {
          speaker: 'morrow',
          text: 'To the people we brought home. To the ones who opened their doors. And to everyone who gets to keep what we won.',
        },
        { speaker: 'quill', text: 'To the district. Paid back. Free to leave. Free to stay.' },
        {
          speaker: 'voss',
          text: 'When I called you, I asked for four people and a van. I didn’t know I was asking for a life. Thank you. All of you.',
        },
        { speaker: 'morrow', text: 'Glasses up. We’re home.' },
      ],
    },
  },
  threshold: {
    briefing: {
      objective: 'Recover the tower service KEY, then have its carrier work LINK to call the lift.',
      extract: 'Board LIFT with KEY and every survivor once the car arrives.',
      rules:
        'LINK takes five seconds; the car takes eighteen seconds to arrive. Its wired bell draws the local reserve even with RADIO disabled. Sunset has night sight ranges.',
    },
    epilogue: {
      lead: 'The service lift leaves the street behind.',
      body: 'The original key opens a route beyond the executive lockdown. Below, the interchange returns to the independent exchange. Above, Dacre has joined Holt in the penthouse. There is no district left for them to send the crew back through.',
    },
    scene: {
      title: 'Above the last street',
      setting: 'safehouse',
      beats: [
        {
          speaker: 'voss',
          text: 'The lift answered. I can see the car moving above the public floors. They cannot recall it from the chairman’s desk.',
        },
        {
          speaker: 'quill',
          text: 'The repayments stand. The seizure crews have no orders left to enforce. Whatever happens upstairs, those people keep what was returned.',
        },
        {
          speaker: 'dacre',
          setting: 'boardroom',
          text: 'The interchange is lost. I have brought the remaining officers up here. There will be no more positions between us and that lift.',
        },
        { speaker: 'holt', text: 'Then stay. You know which doors will hold.' },
        { speaker: 'dacre', text: 'I know which doors they have already opened.' },
      ],
    },
  },
  continuity: {
    briefing: {
      objective:
        'Remove Ada Kestrel from the upper control room: arrest her at CUFF, or attack her directly.',
      extract:
        'Use DOWN, then bring every survivor to VAN. An arrested Kestrel must leave with you.',
      rules:
        'Arrest requires both ground-floor feeds isolated. Click UP / DOWN to change floors; select a crew portrait to follow a split teammate.',
    },
    epilogue: {
      lead: 'Kestrel no longer controls the network.',
      body: 'The independent exchange accepts the handover. The repayments and seizure recall remain in force. With the director of continuity removed, Dacre gathers the remaining security crews at the transit interchange.',
    },
    scene: {
      title: 'An empty control room',
      setting: 'safehouse',
      beats: [
        {
          speaker: 'voss',
          text: 'The local switches answer again. Every district can disconnect itself. Kestrel cannot close those circuits from her desk anymore.',
        },
        {
          speaker: 'quill',
          text: 'Put the handover on the public record. The people who received their money need to know it stays theirs.',
        },
        {
          speaker: 'dacre',
          setting: 'boardroom',
          text: 'Continuity House is lost. Kestrel is out. I am bringing the remaining crews to the interchange.',
        },
        {
          speaker: 'holt',
          text: 'Then you hold the interchange. There will be no replacement director.',
        },
        {
          speaker: 'dacre',
          text: 'There are people at those gates, not circuits. I will be there with them.',
        },
      ],
    },
  },
  depot: {
    scene: {
      title: 'A name in the margin',
      setting: 'safehouse',
      beats: [
        {
          speaker: 'voss',
          text: 'I kept expecting the door to lock again. Even after we left the yard.',
        },
        {
          speaker: 'voss',
          text: 'The annex address is here. My contract is one entry in a paper ledger. There are whole streets in that book.',
        },
        {
          speaker: 'kestrel',
          setting: 'boardroom',
          text: 'Voss is off-site. Her access has been revoked. The trams will still run tomorrow.',
        },
        { speaker: 'holt', text: 'Who authorised her departure?' },
        { speaker: 'kestrel', text: 'Nobody. That is what I am reporting.' },
        {
          speaker: 'holt',
          text: 'Then keep her account open. I want to know who tries to settle it.',
        },
      ],
    },
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
    scene: {
      title: 'The same signature',
      setting: 'safehouse',
      beats: [
        {
          speaker: 'voss',
          text: 'Here. The amount changes, but the destination does not. They have been taking money out of every account on this page.',
        },
        {
          speaker: 'voss',
          text: 'Severin Holt signed the exception. I used to see his name on the safety notices.',
        },
        { speaker: 'holt', setting: 'boardroom', text: 'Was the original taken?' },
        {
          speaker: 'kestrel',
          text: 'Yes. A replacement will not survive comparison with the bank copy.',
        },
        {
          speaker: 'holt',
          text: 'Then do not replace it. Find out who has started asking the bank questions.',
        },
      ],
    },
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
    scene: {
      title: 'The objections',
      setting: 'safehouse',
      beats: [
        {
          speaker: 'voss',
          text: 'The keys work. There were objections to these transfers. Someone noticed before I did.',
        },
        {
          speaker: 'voss',
          text: 'Ren Quill. The same name on every rejected audit. The last entry gives a remand station, not an office.',
        },
        {
          speaker: 'dacre',
          setting: 'boardroom',
          text: 'The courier case is gone. Quill is the next person they will look for.',
        },
        { speaker: 'holt', text: 'He was supposed to agree to a corrected statement.' },
        { speaker: 'dacre', text: 'He has not. I have moved him into transport custody.' },
        { speaker: 'holt', text: 'Keep the statement with him. I still need his signature.' },
      ],
    },
    briefing: {
      objective: 'Recover the security courier’s CASE of account keys.',
      extract: 'Bring CASE and every survivor to the west-street VAN.',
      rules: 'The courier waits for CALL. There is no transfer countdown before you request it.',
    },
    epilogue: {
      lead: 'The access keys are secured.',
      body: 'Voss uses the keys to open the escrow records. The objections all bear the same auditor’s name: Ren Quill, now held at the remand station.',
    },
  },
  custody: {
    scene: {
      title: 'An uncorrected statement',
      setting: 'safehouse',
      beats: [
        {
          speaker: 'quill',
          text: 'They brought me a clean statement every morning. No missing payments. No unlawful charges. A space for my signature.',
        },
        { speaker: 'voss', text: 'You did not sign.' },
        { speaker: 'quill', text: 'I nearly did. Show me what you found.' },
        {
          speaker: 'quill',
          text: 'These entries are enough. They cannot correct every copy if enough people have one.',
        },
        {
          speaker: 'dacre',
          setting: 'boardroom',
          text: 'Quill is out. I want authority to coordinate the sites, not another guard at every door.',
        },
        {
          speaker: 'holt',
          text: 'You will have it. Keep the main roads open. People still have to get to work.',
        },
      ],
    },
    briefing: {
      objective: 'Free auditor Ren Quill from the locked security transport.',
      extract: 'Bring Quill and every survivor to STREET or SERVICE.',
      rules: 'Quill is unarmed, slow and vulnerable once he leaves the transport.',
    },
    epilogue: {
      lead: 'Ren Quill is free.',
      body: 'Quill asks for the ledger before he asks where you are taking him. By morning, he has matched its entries to the escrow transfers and begun writing his audit.',
    },
  },
  broadcast: {
    scene: {
      title: 'Acknowledgements',
      setting: 'safehouse',
      beats: [
        {
          speaker: 'quill',
          text: 'A clinic has acknowledged the audit. So has a tram drivers’ association. I have never spoken to either of them.',
        },
        { speaker: 'voss', text: 'They recognise the amounts.' },
        {
          speaker: 'kestrel',
          setting: 'boardroom',
          text: 'The audit has left our network. We cannot take it back.',
        },
        { speaker: 'holt', text: 'Can collections continue?' },
        {
          speaker: 'kestrel',
          text: 'The recovery cores still hold the accounts. I built them to survive a district outage.',
        },
        { speaker: 'holt', text: 'Then keep them running. I will answer the audit.' },
      ],
    },
    briefing: {
      objective: 'Publish Quill’s audit at UPLINK.',
      extract: 'Once the audit is public, bring every survivor to VAN.',
      rules:
        'The operator needs free hands and cannot fire while working. Upload progress survives interruptions.',
    },
    epilogue: {
      lead: 'Quill’s audit is public.',
      body: 'Acknowledgements of Quill’s audit begin arriving from addresses he does not recognise. He saves each one, then opens the inventory of the company’s debt-recovery machines.',
    },
  },
  severance: {
    scene: {
      title: 'What cannot be restored',
      setting: 'boardroom',
      beats: [
        {
          speaker: 'kestrel',
          text: 'Both recovery cores are gone. The accounts on them cannot be restored.',
        },
        { speaker: 'holt', text: 'You said they would survive an outage.' },
        {
          speaker: 'kestrel',
          text: 'They would. Someone went inside and destroyed them. I am reviewing the access design of every remaining site.',
        },
        {
          speaker: 'dacre',
          text: 'Give me the plans before you alter the doors. My people have to get out of those rooms too.',
        },
        {
          speaker: 'quill',
          setting: 'safehouse',
          text: 'The debts on those machines are gone. Now we have to return the money they already took.',
        },
        {
          speaker: 'voss',
          text: 'The settlement keys are still physical. Kestrel never trusted a network with everything.',
        },
      ],
    },
    briefing: {
      objective: 'Plant charges at WEST and EAST, then detonate both backups.',
      extract: 'After destroying both cores, bring every survivor to VAN.',
      rules:
        'Completed charges stay armed without a timer. Everyone must leave both marked blast areas before detonation.',
    },
    epilogue: {
      lead: 'Both backups are destroyed.',
      body: 'Neither recovery core answers Voss’s checks. Quill turns to the frozen escrow: the debts cannot be rebuilt from those machines, but the money still has to reach its owners.',
    },
  },
  clearing: {
    scene: {
      title: 'Custodians',
      setting: 'safehouse',
      beats: [
        {
          speaker: 'quill',
          text: 'The bank accepts the keys. It wants the original restitution mandate before it will release anything.',
        },
        { speaker: 'voss', text: 'So the money is there.' },
        { speaker: 'quill', text: 'Yes. For once, that is not the part they are lying about.' },
        {
          speaker: 'kestrel',
          setting: 'boardroom',
          text: 'The authorisation works remains on local power. A lost radio channel will not switch off its security.',
        },
        { speaker: 'dacre', text: 'And at your own station?' },
        {
          speaker: 'kestrel',
          text: 'I will keep the controls within reach. If they want that building, they will have to come through me.',
        },
      ],
    },
    briefing: {
      objective: 'Recover the settlement KEYS from the north vault.',
      extract: 'Bring KEYS and every survivor to the north-east VAN.',
      rules: 'The case occupies both hands and is conspicuous even in uniform.',
    },
    epilogue: {
      lead: 'The settlement keys are secured.',
      body: 'Quill tests the settlement keys against the frozen account. The bank accepts them, then asks for the original restitution mandate before it will release a payment.',
    },
  },
  mandate: {
    scene: {
      title: 'The list of names',
      setting: 'safehouse',
      beats: [
        {
          speaker: 'quill',
          text: 'The seals agree. We can finally put names beside the repayments.',
        },
        { speaker: 'voss', text: 'How many?' },
        { speaker: 'quill', text: 'Enough that I have to turn the page.' },
        {
          speaker: 'dacre',
          setting: 'boardroom',
          text: 'They are moving the mandate. I have teams watching the routes away from the works.',
        },
        { speaker: 'holt', text: 'Bring me the document.' },
        { speaker: 'dacre', text: 'If I can take their people alive, I will bring them too.' },
      ],
    },
    briefing: {
      objective: 'Recover the restitution MANDATE from the north records room.',
      extract: 'Bring MANDATE and every survivor to the north-east VAN.',
      rules:
        'Four wired turrets guard the site. RADIO does not disable them. The mandate occupies both hands.',
    },
    epilogue: {
      lead: 'The mandate is secured.',
      body: 'Quill lays the mandate beside the settlement keys and checks every seal. For the first time, he can put names and amounts on the proposed repayments.',
    },
  },
  personnel: {
    scene: {
      title: 'Four places at the table',
      setting: 'safehouse',
      beats: [
        {
          speaker: 'morrow',
          text: 'Vale and Rook are asleep. Nobody uses the old safehouse again.',
        },
        { speaker: 'quill', text: 'The mandate stayed with me. It is still valid.' },
        {
          speaker: 'morrow',
          text: 'Put it on the table. When they wake up, we decide the next move together.',
        },
        {
          speaker: 'dacre',
          setting: 'boardroom',
          text: 'They opened the cells from two positions. Our gates separated my guards more effectively than they separated the rescuers.',
        },
        { speaker: 'kestrel', text: 'You approved the custody layout.' },
        {
          speaker: 'dacre',
          text: 'I did. Next time the command post moves with the line. Nobody waits alone for a door to open.',
        },
      ],
    },
    briefing: {
      objective: 'Morrow and Sable must free Vale and Rook. The mandate stays with Quill.',
      extract: 'Free both prisoners, release EXIT, then bring all four to VAN.',
      rules:
        'Any operative’s death fails the rescue. Cell releases require a separate operative maintaining remote power.',
    },
    epilogue: {
      lead: 'All four are home.',
      body: 'At the new safehouse, Quill puts the mandate on the table. Vale and Rook sit down beside Morrow and Sable to hear what still has to be done.',
    },
  },
  injunction: {
    scene: {
      title: 'Proof of service',
      setting: 'boardroom',
      beats: [
        {
          speaker: 'holt',
          text: 'I have been served. Collections under that mandate are suspended.',
        },
        { speaker: 'dacre', text: 'Should I withdraw the site teams?' },
        {
          speaker: 'holt',
          text: 'No. Suspension does not transfer ownership of the buildings. But nobody invents an order in my name.',
        },
        { speaker: 'kestrel', text: 'You will hear the appeal yourself?' },
        {
          speaker: 'holt',
          text: 'At the Bench. With the original seals present and the chamber secured.',
        },
        {
          speaker: 'quill',
          setting: 'safehouse',
          text: 'Service is acknowledged. Start with the oldest account. That person has waited long enough.',
        },
      ],
    },
    briefing: {
      objective: 'Serve the restitution mandate by uploading it at UPLINK.',
      extract: 'Once the mandate is served, bring every survivor to VAN.',
      rules:
        'Upload progress survives interruptions. Ivory inspectors verify uniforms. RADIO is deep inside a secure office.',
    },
    epilogue: {
      lead: 'Mandate served.',
      body: 'Quill watches the registry acknowledge service. The collection orders are suspended; he opens the list of people still waiting for their money and starts with the first name.',
    },
  },
  settlement: {
    scene: {
      title: 'Money coming in',
      setting: 'safehouse',
      beats: [
        {
          speaker: 'quill',
          text: 'She asked me to read the receipt twice. She thought the incoming payment was another charge.',
        },
        { speaker: 'voss', text: 'Did she believe you?' },
        {
          speaker: 'quill',
          text: 'Eventually. Then she asked whether the men outside would leave.',
        },
        {
          speaker: 'dacre',
          setting: 'boardroom',
          text: 'Seizure teams are still carrying dispatches issued before the suspension. The payments have overtaken the orders.',
        },
        {
          speaker: 'holt',
          text: 'The recall is at the dispatch exchange. Until it is filed, the crews will follow the copies they have.',
        },
        { speaker: 'dacre', text: 'Then the exchange is where this will be decided.' },
      ],
    },
    briefing: {
      objective:
        'Recover REGISTER, reconcile it at CHECK, then operate SIGN and CLEAR together to release repayments.',
      extract: 'Bring REGISTER and every survivor to VAN after the funds clear.',
      rules:
        'Daylight extends human sight by 50%. Two operatives must survive until the transfer is complete. Its progress survives interruptions.',
    },
    epilogue: {
      lead: 'The first repayments have cleared.',
      body: 'Quill checks the first receipt against the register. An account that has carried charges for years now shows money coming in. He calls its owner.',
    },
  },
  countermand: {
    scene: {
      title: 'Beyond the district',
      setting: 'safehouse',
      beats: [
        {
          speaker: 'quill',
          text: 'They have left her doorway. I stayed on the call until she watched the last vehicle turn the corner.',
        },
        { speaker: 'voss', text: 'This district keeps its money.' },
        { speaker: 'quill', text: 'Yes. Whatever comes next, that happened.' },
        {
          speaker: 'holt',
          setting: 'boardroom',
          text: 'The district loss is final. Close the account. I will not spend another crew trying to reverse it.',
        },
        {
          speaker: 'dacre',
          text: 'I will take the remaining companies to the transit interchange. We can hold a line there without relying on site radios.',
        },
        {
          speaker: 'kestrel',
          text: 'My control room is on the other side of that line. Every door answers locally. If they come, I will be there to operate them.',
        },
        {
          speaker: 'holt',
          text: 'And I will be at the Bench. They have learned what my signature can take away. Let them come and ask me for the rest.',
        },
      ],
    },
    briefing: {
      objective:
        'Recover RECALL and have its carrier file it at FILE for nine uninterrupted seconds.',
      extract: 'Bring the original RECALL and every survivor to VAN after filing.',
      rules:
        'Daylight extends human sight by 50%. Carrying the original occupies both hands and attracts suspicion, even in uniform.',
    },
    epilogue: {
      lead: 'The seizure crews have been recalled.',
      body: 'Voss checks each withdrawn dispatch against the original. Quill calls the woman whose repayment arrived that morning. This time, he can tell her that the men at the door have been ordered to leave.',
    },
  },
};
