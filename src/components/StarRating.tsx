import { Star } from 'lucide-react';

export function StarRating({ value }: { value: number }) {
  return <div className="rating-display" aria-label={`${value} out of 5 stars`}><span className="stars" aria-hidden="true">{'★'.repeat(value)}<span className="empty-stars">{'☆'.repeat(5 - value)}</span></span><strong aria-hidden="true">{value} <span>/ 5</span></strong></div>;
}
export function StarSelector({ value, onChange, error }: { value: number; onChange: (n: number) => void; error?: string }) {
  const descriptions = ['Poor', 'Fair', 'Good', 'Great', 'Excellent'];
  return <fieldset className="rating-field" aria-describedby={error ? 'rating-error' : undefined}>
    <legend>Overall rating <span className="required">*</span></legend>
    <div className="star-options">{[1, 2, 3, 4, 5].map(n => <label key={n} className={n <= value ? 'active' : ''}>
      <input type="radio" name="rating" value={n} checked={value === n} onChange={() => onChange(n)} aria-label={`${n} ${n === 1 ? 'star' : 'stars'} — ${descriptions[n - 1]}`} />
      <Star size={30} aria-hidden="true" />
    </label>)}<span className="rating-word">{value ? descriptions[value - 1] : 'Tap to rate'}</span></div>
    {error && <span className="field-error" id="rating-error">{error}</span>}
  </fieldset>;
}
