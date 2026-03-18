import type { Photo } from '../model/types';

interface PhotoCardProps {
  photo: Photo;
  isSelected: boolean;
  onClick: () => void;
}

export function PhotoCard({ photo, isSelected, onClick }: PhotoCardProps) {
  return (
    <div
      onClick={onClick}
      className="relative cursor-pointer group"
      style={{
        outline: isSelected ? '2px solid #929292' : '2px solid transparent',
        outlineOffset: '2px',
      }}
    >
      <div className="relative overflow-hidden bg-[#222222]" style={{ aspectRatio: '3/2' }}>
        <img
          src={photo.thumbnailDataUrl}
          alt={photo.fileName}
          className="w-full h-full object-cover"
          draggable={false}
        />
        {/* Bottom info bar */}
        <div className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="text-[10px] text-[#929292] truncate">{photo.fileName}</p>
        </div>
      </div>
      {/* Rating dots */}
      {photo.rating > 0 && (
        <div className="absolute top-1 left-1 flex gap-0.5">
          {Array.from({ length: photo.rating }).map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#f2f2f2]" />
          ))}
        </div>
      )}
    </div>
  );
}
