import type { Mission } from '../sim/types';
import type { TypingDevice } from '../audio/typing';

export type StoryId = 'opening' | Mission['id'];
export type StorySetting = keyof typeof storySettings;
export type StorySpeaker = keyof typeof storySpeakers;
export interface StoryScene {
  title: string;
  setting: StorySetting;
  typing?: TypingDevice;
  beats: { speaker: StorySpeaker; text: string; setting?: StorySetting; typing?: TypingDevice }[];
}

// Paths are assigned only when a scene is opened. No story art is preloaded by
// the mission UI, and every scene remains readable if an image fails to load.
export const storySettings = {
  safehouse: { name: 'Off the company network', image: 'assets/story/safehouse.webp' },
  boardroom: { name: 'The executive floor', image: 'assets/story/boardroom.webp' },
};
export const storySpeakers = {
  morrow: {
    name: 'Morrow',
    role: 'Field lead',
    image: 'assets/portraits.webp',
    size: '200% 200%',
    position: 'left top',
  },
  voss: {
    name: 'Iona Voss',
    role: 'Engineer',
    image: 'assets/witnesses.webp',
    size: '200% 100%',
    position: 'left center',
  },
  mara: {
    name: 'Mara Quill',
    role: 'Auditor',
    image: 'assets/witnesses.webp',
    size: '200% 100%',
    position: 'right center',
  },
  holt: {
    name: 'Severin Holt',
    role: 'Chairman',
    image: 'assets/story/holt.webp',
    size: 'cover',
    position: 'center',
  },
  kestrel: {
    name: 'Ada Kestrel',
    role: 'Director of continuity',
    image: 'assets/story/kestrel.webp',
    size: 'cover',
    position: 'center',
  },
  dacre: {
    name: 'Lucan Dacre',
    role: 'Security marshal',
    image: 'assets/story/dacre.webp',
    size: 'cover',
    position: 'center',
  },
};

export const openingScene: StoryScene = {
  title: 'The remaining balance',
  setting: 'safehouse',
  typing: 'phone',
  beats: [
    {
      speaker: 'voss',
      text: 'I paid for the training. Then the tools. Then the room above the depot. Every time I finished paying, another charge appeared.',
    },
    {
      speaker: 'morrow',
      text: 'You asked for four people and a van. Are you leaving a job, or escaping a prison?',
    },
    {
      speaker: 'voss',
      text: 'There used to be a difference. My pass still opens the workshop. It stopped opening the street door on Tuesday.',
    },
    { speaker: 'morrow', text: 'Do you have somewhere to go?' },
    {
      speaker: 'voss',
      text: 'I have an address where they keep the contracts. But first I need to get out of here.',
    },
    {
      speaker: 'holt',
      setting: 'boardroom',
      text: 'The district report says every account is in good standing. Leave it on my desk. I will sign it before morning.',
    },
  ],
};
