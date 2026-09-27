import type { Dataset } from '../data/types';

interface Props {
  label: string;
  datasets: Dataset[];
  value: string;
  onChange: (id: string) => void;
  /** Ids to show but not allow (e.g. the other track in a duet). */
  disabledIds?: string[];
}

/** A "record" selector: which dataset is loaded in this slot. */
export function DatasetPicker({ label, datasets, value, onChange, disabledIds = [] }: Props) {
  return (
    <label className="field picker">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {datasets.map((d) => (
          <option key={d.id} value={d.id} disabled={disabledIds.includes(d.id)}>
            {d.title}
          </option>
        ))}
      </select>
    </label>
  );
}
