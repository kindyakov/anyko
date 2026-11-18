import { FileImage, FileText, FileType2 } from 'lucide-react';

const appearances = {
  pdf: {
    Icon: FileText,
    tile: 'border-rose-400/25 bg-rose-500/12 text-rose-300',
    badge: 'border-rose-400/30 bg-[#351923] text-rose-200',
  },
  docx: {
    Icon: FileType2,
    tile: 'border-blue-400/25 bg-blue-500/12 text-blue-300',
    badge: 'border-blue-400/30 bg-[#192741] text-blue-200',
  },
  image: {
    Icon: FileImage,
    tile: 'border-teal-400/25 bg-teal-500/12 text-teal-300',
    badge: 'border-teal-400/30 bg-[#113531] text-teal-200',
  },
  other: {
    Icon: FileText,
    tile: 'border-white/10 bg-white/[0.03] text-zinc-300',
    badge: 'border-white/10 bg-[#1b1b20] text-zinc-300',
  },
};

function fileExtension(filename: string) {
  return /\.([a-z0-9]+)$/i.exec(filename)?.[1]?.toLowerCase() ?? '';
}

export function FileIcon({
  filename,
  className = 'size-12',
}: {
  filename: string;
  className?: string;
}) {
  const extension = fileExtension(filename);
  const { Icon, tile, badge } = /^(jpe?g|png|webp|tiff?|avif|heif|heic)$/.test(
    extension,
  )
    ? appearances.image
    : extension === 'pdf' || extension === 'docx'
      ? appearances[extension]
      : appearances.other;
  return (
    <span
      aria-hidden
      className={`relative grid shrink-0 place-items-center rounded-xl border ${tile} ${className}`}
    >
      <Icon size={22} strokeWidth={1.5} />
      <span
        className={`absolute -right-1.5 -bottom-1.5 rounded-md border px-1 text-[9px] font-semibold tracking-wide uppercase ${badge}`}
      >
        {extension.slice(0, 4) || 'file'}
      </span>
    </span>
  );
}
