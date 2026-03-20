import { useState } from 'react';
import { Star } from 'lucide-react';

type StarRatingProps = {
  value: number;
  onChange: (rating: number) => void;
  size?: 'sm' | 'md';
};

const STAR_COUNT = 5;

export function StarRating({ value, onChange, size = 'md' }: StarRatingProps) {
  const [hoverVal, setHoverVal] = useState(0);
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const displayVal = hoverVal || value;

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHoverVal(0)}
    >
      {Array.from({ length: STAR_COUNT }, (_, i) => {
        const starVal = i + 1;
        const filled = starVal <= displayVal;
        return (
          <button
            key={starVal}
            onClick={(e) => { e.stopPropagation(); onChange(starVal === value ? 0 : starVal); }}
            onMouseEnter={() => setHoverVal(starVal)}
            className={`cursor-pointer transition-colors ${
              filled ? 'text-yellow-400' : 'text-[#555] hover:text-[#888]'
            }`}
            title={`${starVal} star${starVal > 1 ? 's' : ''}`}
          >
            <Star className={iconSize} fill={filled ? 'currentColor' : 'none'} />
          </button>
        );
      })}
    </div>
  );
}
