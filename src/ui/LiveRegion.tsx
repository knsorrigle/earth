import { usePlayerStore } from '../state/playerStore';

/**
 * Screen-reader announcements. Two alternating polite regions so that the
 * same sentence announced twice in a row is still read out.
 */
export function LiveRegion() {
  const { text, id } = usePlayerStore((s) => s.announcement);
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {id % 2 === 0 ? text : ''}
      </div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {id % 2 === 1 ? text : ''}
      </div>
    </>
  );
}
