import { getDataset } from '../../data/registry';
import { usePlayerStore } from '../../state/playerStore';

/** Switch the map dataset, keeping the date inside the new dataset's range. */
export function selectMapDataset(id: string) {
  const d = getDataset(id);
  const { explore, setExplore, announce } = usePlayerStore.getState();
  let date = explore.date;
  if (date < d.dateRange.start) date = d.dateRange.start;
  if (date > d.dateRange.end) date = d.frame?.defaultDate ?? d.dateRange.end;
  setExplore({ datasetId: id, date });
  announce(`${d.title} loaded`);
}
