import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Download, Image as ImageIcon, Volume2 } from 'lucide-react';
import type { GeneratedMediaItem } from '../types.ts';

function toSafeSlug(title: string, fallback: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

// ---------------------------------------------------------------------------
// 1. Free AI Image / Technical Diagram Renderer + PNG/SVG Download
// ---------------------------------------------------------------------------

const ImageMediaCard: React.FC<{
  item: Extract<GeneratedMediaItem, { kind: 'image' }>;
}> = ({ item }) => {
  const handleDownloadSvg = () => {
    const blob = new Blob([item.svgMarkup], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${toSafeSlug(item.title, 'agron-diagram')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = () => {
    const svgBlob = new Blob([item.svgMarkup], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((pngBlob) => {
          if (!pngBlob) return;
          const pngUrl = URL.createObjectURL(pngBlob);
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = `${toSafeSlug(item.title, 'agron-diagram')}.png`;
          a.click();
          URL.revokeObjectURL(pngUrl);
        }, 'image/png');
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="border border-[#DCE2DC] bg-[#FAFBF9] rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#E6E9E4] flex flex-wrap items-center justify-between gap-2 bg-white">
        <div className="flex items-center gap-2 min-w-0">
          <ImageIcon className="w-4 h-4 text-[#166534] shrink-0" />
          <span className="text-xs font-semibold text-[#141A16] truncate">
            {item.title}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadPng}
            className="px-2.5 py-1 rounded-md border border-[#D4DAD4] bg-white hover:bg-[#F1F4EF] text-[11px] font-medium text-[#1A221D] inline-flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3 h-3" />
            PNG
          </button>
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="px-2.5 py-1 rounded-md border border-[#D4DAD4] bg-white hover:bg-[#F1F4EF] text-[11px] font-medium text-[#1A221D] inline-flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3 h-3" />
            SVG
          </button>
        </div>
      </div>

      <div className="p-3 bg-white flex justify-center">
        <div
          className="w-full max-w-[720px] rounded-lg border border-[#EBEEE9] overflow-hidden [&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
          dangerouslySetInnerHTML={{ __html: item.svgMarkup }}
        />
      </div>

      {item.description && (
        <div className="px-4 py-2 border-t border-[#EBEEE9] text-xs text-[#5E6A62]">
          {item.description}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 2. Free AI Audio Player (Gemini 3.8 Flash Lite TTS WAV)
// ---------------------------------------------------------------------------

const AudioMediaCard: React.FC<{
  item: Extract<GeneratedMediaItem, { kind: 'audio' }>;
}> = ({ item }) => {
  const handleDownloadWav = () => {
    const a = document.createElement('a');
    a.href = item.audioDataUrl;
    a.download = `${toSafeSlug(item.title, 'agron-audio')}.wav`;
    a.click();
  };

  return (
    <div className="border border-[#DCE2DC] bg-[#FAFBF9] rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#E6E9E4] flex items-center justify-between gap-2 bg-white">
        <div className="flex items-center gap-2 min-w-0">
          <Volume2 className="w-4 h-4 text-[#166534] shrink-0" />
          <span className="text-xs font-semibold text-[#141A16] truncate">
            {item.title}
          </span>
          <span className="text-[11px] text-[#647068] whitespace-nowrap">
            · Voice: {item.voiceName}
          </span>
        </div>
        <button
          type="button"
          onClick={handleDownloadWav}
          className="px-2.5 py-1 rounded-md border border-[#D4DAD4] bg-white hover:bg-[#F1F4EF] text-[11px] font-medium text-[#1A221D] inline-flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <Download className="w-3 h-3" />
          WAV
        </button>
      </div>

      <div className="p-4 space-y-2.5 bg-white">
        <audio
          controls
          src={item.audioDataUrl}
          className="w-full h-9"
          preload="metadata"
        />
        {item.script && (
          <p className="text-xs text-[#4A554E] leading-relaxed">
            {item.script}
          </p>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Unified Export (Image + Audio only — Video AI removed)
// ---------------------------------------------------------------------------

export const MediaBlockList: React.FC<{ media: GeneratedMediaItem[] }> = ({
  media,
}) => {
  const prefersReduced = useReducedMotion();
  if (!media || media.length === 0) return null;
  return (
    <div className="space-y-3">
      {media.map((item) => (
        <motion.div
          key={item.id}
          initial={prefersReduced ? false : { opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        >
          {item.kind === 'image' ? (
            <ImageMediaCard item={item} />
          ) : (
            <AudioMediaCard item={item} />
          )}
        </motion.div>
      ))}
    </div>
  );
};
