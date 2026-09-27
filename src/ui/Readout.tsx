import { AnimatePresence, motion } from 'framer-motion';
import type { Dataset } from '../data/types';
import type { NoteEvent, ReferenceTone } from '../mapping/types';
import { usePlayerStore } from '../state/playerStore';

interface Props {
  dataset: Dataset;
  event: NoteEvent;
  reference: ReferenceTone;
}

/** Big year + value readout and the visible caption for the latest sound. */
export function Readout({ dataset, event, reference }: Props) {
  const caption = usePlayerStore((s) => s.caption);
  const d = event.deviation;
  const pct = Math.round((d / reference.value) * 100);
  const sign = d > 0 ? '+' : d < 0 ? '−' : '±';

  return (
    <section className="readout" aria-label="Current reading">
      <div className="readout-year" aria-hidden="true">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={event.year}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.14 }}
          >
            {event.year}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="readout-value">
        <span className="num">{event.value.toFixed(dataset.decimals)}</span> <span className="unit">{dataset.unit}</span>
      </div>
      <div className={`readout-delta ${d < 0 ? 'neg' : d > 0 ? 'pos' : ''}`}>
        {sign}
        {Math.abs(d).toFixed(dataset.decimals)} ({sign}
        {Math.abs(pct)}%) vs {reference.year}
      </div>
      <p className="caption" aria-label="Sound caption">
        {caption || 'Press Play or Space to listen.'}
      </p>
    </section>
  );
}
