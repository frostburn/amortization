import { typingVoices } from '../audio/typing';
import type { TypingSpeaker } from '../audio/typing';

/** UTF-16 offsets at grapheme boundaries, so accents and emoji stay intact.
 * Punctuation gives the reader a breath and never produces a keyboard stroke. */
export function revealSchedule(text: string, speaker: TypingSpeaker) {
  const voice = typingVoices[speaker];
  let at = 80,
    index = 0;
  return Array.from(
    new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text),
    ({ segment, index: offset }) => {
      const point = { at, end: offset + segment.length, key: /[\p{L}\p{N}]/u.test(segment) };
      at += voice.interval * voice.rhythm[index++ % voice.rhythm.length];
      if (/[.!?…]/u.test(segment)) at += 210 * voice.pause;
      else if (/[,;:—]/u.test(segment)) at += 90 * voice.pause;
      return point;
    },
  );
}
