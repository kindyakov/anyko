import { FileImage, FileText, FileType2 } from 'lucide-react';

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
  const Icon = /^(jpe?g|png|webp|tiff?)$/.test(extension)
    ? FileImage
    : extension === 'docx'
      ? FileType2
      : FileText;
  return (
    <span
      aria-hidden
      className={`relative grid shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300 ${className}`}
    >
      <Icon size={22} strokeWidth={1.5} />
      <span className="absolute -right-1.5 -bottom-1.5 rounded-md border border-white/10 bg-[#1b1b20] px-1 text-[9px] font-semibold tracking-wide text-zinc-300 uppercase">
        {extension.slice(0, 4) || 'file'}
      </span>
    </span>
  );
}
