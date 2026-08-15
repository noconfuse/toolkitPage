import * as React from 'react';

type SvgProps = React.SVGProps<SVGSVGElement>;

const strokeProps: SvgProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.25,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const baseSvgProps: SvgProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 100 100',
  width: '100%',
  height: '100%',
};

// ───────── Hero: 轨道星图（多层轨道 + 公转节点 + 虚线流动） ─────────
export function HeroComposition(props: SvgProps) {
  return (
    <svg {...baseSvgProps} {...strokeProps} {...props}>
      <style>
        {`
        .tk-o{animation:tk-spin 60s linear infinite;transform-box:view-box;transform-origin:50px 50px}
        .tk-o-rev{animation:tk-spin-rev 84s linear infinite;transform-box:view-box;transform-origin:50px 50px}
        .tk-flow{animation:tk-dash 9s linear infinite}
        .tk-p1{animation:tk-pulse 2.8s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
        .tk-p2{animation:tk-pulse 3.6s ease-in-out infinite 0.6s;transform-box:fill-box;transform-origin:center}
        .tk-p3{animation:tk-pulse 4.4s ease-in-out infinite 1.2s;transform-box:fill-box;transform-origin:center}
        .tk-core{animation:tk-core 2.6s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:center}
        .tk-halo{animation:tk-halo 3.4s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:center}
        .tk-float{animation:tk-float 5.5s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:center}
        @keyframes tk-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes tk-spin-rev{from{transform:rotate(360deg)}to{transform:rotate(0)}}
        @keyframes tk-dash{from{stroke-dashoffset:0}to{stroke-dashoffset:-36}}
        @keyframes tk-pulse{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:1;transform:scale(1.4)}}
        @keyframes tk-core{from{opacity:.65;transform:scale(1)}to{opacity:1;transform:scale(1.5)}}
        @keyframes tk-halo{from{opacity:.22;transform:scale(1)}to{opacity:.04;transform:scale(1.6)}}
        @keyframes tk-float{from{transform:translateY(1px)}to{transform:translateY(-2px)}}
        @media (prefers-reduced-motion:reduce){.tk-o,.tk-o-rev,.tk-flow,.tk-p1,.tk-p2,.tk-p3,.tk-core,.tk-halo,.tk-float{animation:none}}
        `}
      </style>
      {/* 外轨道：细刻度环 + 主环，缓慢正转 */}
      <g className="tk-o">
        <circle cx="50" cy="50" r="42" strokeDasharray="0.8 3.55" opacity="0.5" />
        <circle cx="50" cy="50" r="34" opacity="0.9" />
        {/* 中心 → 节点的连接线（随轨道公转） */}
        <path d="M50 50 L50 8" strokeDasharray="2 3" opacity="0.45" />
        <path d="M50 50 L79.7 79.7" strokeDasharray="2 3" opacity="0.45" />
        <path d="M50 50 L20.3 79.7" strokeDasharray="2 3" opacity="0.45" />
        {/* 轨道节点（错峰脉冲） */}
        <circle className="tk-p1" cx="50" cy="8" r="2.4" fill="currentColor" stroke="none" />
        <circle className="tk-p2" cx="79.7" cy="79.7" r="1.9" fill="currentColor" stroke="none" />
        <circle className="tk-p3" cx="20.3" cy="79.7" r="1.5" fill="currentColor" stroke="none" />
      </g>
      {/* 内层虚线环：反向缓转 + 虚线游走 */}
      <g className="tk-o-rev">
        <circle className="tk-flow" cx="50" cy="50" r="23" strokeDasharray="4 3" opacity="0.55" />
      </g>
      {/* 中心核 + 呼吸光环 */}
      <circle className="tk-halo" cx="50" cy="50" r="6.5" />
      <circle className="tk-core" cx="50" cy="50" r="3" fill="currentColor" stroke="none" />
      {/* 浮动装饰点 */}
      <g className="tk-float">
        <rect x="84" y="20" width="2.6" height="2.6" opacity="0.6" />
        <rect x="12" y="34" width="2" height="2" opacity="0.4" />
      </g>
    </svg>
  );
}

// ───────── 工具缩略图 ─────────
export function ThumbImageCombine(props: SvgProps) {
  return (
    <svg {...baseSvgProps} {...strokeProps} {...props}>
      <rect x="14" y="22" width="46" height="46" rx="2" />
      <rect x="32" y="30" width="54" height="48" rx="2" />
      <path d="M22 60 L32 50 L42 60 L48 54 L58 64" />
      <circle cx="44" cy="40" r="3" />
      <path d="M64 82 L78 82 M74 78 L78 82 L74 86" />
    </svg>
  );
}

export function ThumbPdfStamp(props: SvgProps) {
  return (
    <svg {...baseSvgProps} {...strokeProps} {...props}>
      <path d="M28 18 L62 18 L72 28 L72 84 L28 84 Z" />
      <path d="M62 18 L62 28 L72 28" />
      <path d="M34 38 L60 38" opacity="0.5" />
      <path d="M34 44 L66 44" opacity="0.5" />
      <path d="M34 50 L54 50" opacity="0.5" />
      <rect
        x="40"
        y="56"
        width="28"
        height="22"
        strokeDasharray="3 2"
        opacity="0.7"
      />
      <rect x="46" y="62" width="16" height="10" />
      <circle cx="50" cy="66" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ThumbPdfImageConvert(props: SvgProps) {
  return (
    <svg {...baseSvgProps} {...strokeProps} {...props}>
      <rect x="14" y="26" width="36" height="48" rx="2" />
      <path d="M40 26 L50 26 L50 36 L40 36 Z" />
      <path d="M20 44 L44 44 M20 50 L40 50 M20 56 L36 56" opacity="0.5" />
      <path d="M58 58 L78 58 L86 66 L86 78 L58 78 Z" />
      <path d="M78 58 L78 66 L86 66" />
      <path d="M64 70 L82 70 M64 74 L78 74" opacity="0.5" />
      <path d="M48 50 L60 50 M54 44 L60 50 L54 56" />
    </svg>
  );
}

export function ThumbImageCompress(props: SvgProps) {
  return (
    <svg {...baseSvgProps} {...strokeProps} {...props}>
      <rect x="14" y="22" width="40" height="56" rx="3" />
      <path d="M22 36 L34 48 L42 40 L48 56" />
      <circle cx="40" cy="32" r="3" />
      <path d="M52 50 L52 78 M52 78 L46 72 M52 78 L58 72" strokeWidth="1.5" />
      <rect x="64" y="38" width="22" height="40" rx="2" opacity="0.4" />
      <path d="M70 50 L80 50 M70 56 L78 56 M70 62 L82 62" opacity="0.5" />
    </svg>
  );
}

export function ThumbImageConvert(props: SvgProps) {
  return (
    <svg {...baseSvgProps} {...strokeProps} {...props}>
      <rect x="12" y="24" width="34" height="46" rx="2" />
      <path d="M20 36 L30 46 L38 40 L44 54" />
      <rect x="54" y="30" width="34" height="46" rx="2" opacity="0.4" />
      <path d="M62 42 L74 42 M62 48 L70 48 M62 54 L76 54" opacity="0.5" />
      <path d="M48 20 L54 14 L54 20 Z M48 20 L54 20" />
      <path d="M52 80 L58 86 L58 80 Z M52 80 L58 80" />
    </svg>
  );
}

export function ThumbQrCode(props: SvgProps) {
  return (
    <svg {...baseSvgProps} {...strokeProps} {...props}>
      <rect x="18" y="18" width="64" height="64" rx="4" />
      <rect x="26" y="26" width="16" height="16" />
      <rect x="58" y="26" width="16" height="16" />
      <rect x="26" y="58" width="16" height="16" />
      <path d="M50 44 L50 44" strokeWidth="2" />
      <rect x="46" y="46" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="52" y="46" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="58" y="46" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="46" y="52" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="52" y="52" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="58" y="52" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="46" y="58" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="52" y="58" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="58" y="58" width="3" height="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ThumbPdfMerge(props: SvgProps) {
  return (
    <svg {...baseSvgProps} {...strokeProps} {...props}>
      <rect x="10" y="18" width="30" height="46" rx="2" />
      <path d="M16 30 L34 30 M16 36 L30 36 M16 42 L34 42" opacity="0.5" />
      <rect x="60" y="18" width="30" height="46" rx="2" />
      <path d="M66 30 L84 30 M66 36 L80 36 M66 42 L84 42" opacity="0.5" />
      <rect x="34" y="48" width="32" height="34" rx="2" />
      <path d="M40 60 L54 60 M40 66 L52 66 M40 72 L56 72" opacity="0.5" />
      <path d="M50 44 L56 38 L62 44 M56 38 L56 50" />
    </svg>
  );
}

export function ThumbWatermark(props: SvgProps) {
  return (
    <svg {...baseSvgProps} {...strokeProps} {...props}>
      <rect x="14" y="18" width="72" height="64" rx="3" />
      <path d="M24 30 L40 30 L46 37 L40 44 L24 44 Z" opacity="0.5" />
      <path d="M24 48 L46 48" opacity="0.5" />
      <path d="M24 54 L42 54" opacity="0.5" />
      <path d="M56 42 L56 60 M56 60 L50 54 M56 60 L62 54" strokeWidth="1.5" opacity="0.8" />
    </svg>
  );
}

export function ThumbRemoveWatermark(props: SvgProps) {
  return (
    <svg {...baseSvgProps} {...strokeProps} {...props}>
      <rect x="14" y="18" width="72" height="64" rx="3" />
      {/* 被涂抹消除的水印文字（虚线 = 已去除） */}
      <path d="M24 40 L42 40 L50 47 L42 54 L24 54 Z" opacity="0.35" />
      <path d="M24 56 L44 56" opacity="0.35" />
      <path d="M22 36 L46 60 M46 36 L22 60" opacity="0.8" strokeDasharray="2 2" />
      <path d="M60 40 L60 58 M60 58 L54 52 M60 58 L66 52" strokeWidth="1.5" opacity="0.8" />
    </svg>
  );
}

export function ThumbBackgroundReplace(props: SvgProps) {
  return (
    <svg {...baseSvgProps} {...strokeProps} {...props}>
      {/* 原图框 */}
      <rect x="14" y="18" width="72" height="64" rx="3" />
      {/* 背景轮廓（虚线 = 已被 AI 移除） */}
      <path d="M24 36 L38 50 L30 60 L48 70" opacity="0.3" strokeDasharray="3 2" />
      {/* 主体（实线 = 被抠出，浮在画布上） */}
      <path d="M28 70 L28 56 C28 46 46 46 46 56 L46 70" />
      <circle cx="37" cy="42" r="3" />
      {/* 分离指示箭头 */}
      <path d="M54 34 L68 34 M64 30 L68 34 L64 38" />
      {/* 浮动图层小块（表示可叠加到任意背景） */}
      <rect x="56" y="46" width="22" height="16" rx="2" opacity="0.6" />
      <path d="M60 56 L66 62 L62 62 L68 68 M68 62 L64 62" opacity="0.5" />
    </svg>
  );
}

// ───────── 原则图标 ─────────
export function IconLocal(props: SvgProps) {
  return (
    <svg {...baseSvgProps} {...strokeProps} {...props}>
      <rect x="22" y="22" width="56" height="56" rx="6" />
      <path d="M50 32 L50 50 L62 50" />
      <path d="M30 50 L36 50 M64 50 L70 50" opacity="0.5" />
    </svg>
  );
}

export function IconOneJob(props: SvgProps) {
  return (
    <svg {...baseSvgProps} {...strokeProps} {...props}>
      <rect x="22" y="22" width="18" height="18" rx="2" opacity="0.3" />
      <rect x="46" y="22" width="18" height="18" rx="2" />
      <rect x="22" y="46" width="18" height="18" rx="2" opacity="0.3" />
      <rect x="22" y="70" width="18" height="18" rx="2" opacity="0.3" />
      <circle cx="55" cy="31" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconNoTrack(props: SvgProps) {
  return (
    <svg {...baseSvgProps} {...strokeProps} {...props}>
      <path d="M22 50 C32 36 68 36 78 50 C68 64 32 64 22 50 Z" />
      <circle cx="50" cy="50" r="8" />
      <circle cx="50" cy="50" r="3" fill="currentColor" stroke="none" />
      <path d="M20 80 L80 20" strokeWidth="1.5" />
    </svg>
  );
}

export function IconSeo(props: SvgProps) {
  return (
    <svg {...baseSvgProps} {...strokeProps} {...props}>
      <path d="M28 22 L60 22 L72 34 L72 78 L28 78 Z" />
      <path d="M60 22 L60 34 L72 34" />
      <path d="M36 58 L46 50 L54 54 L66 42" />
      <circle cx="66" cy="42" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ───────── 小图标 ─────────
export function FaqGlyph(props: SvgProps) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} {...props}>
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1" />
      <path
        d="M6 6.5 C6 5.5 7 5 8 5 C9 5 10 5.5 10 6.5 C10 7.5 8 7.5 8 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <circle cx="8" cy="11" r="0.5" fill="currentColor" />
    </svg>
  );
}

export function IconArrow(props: SvgProps) {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} {...props}>
      <path
        d="M3 8 L13 8 M9 4 L13 8 L9 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconExternal(props: SvgProps) {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} {...props}>
      <path
        d="M6 3 L6 5 M6 3 L8 3 M6 3 L13 10 M13 6 L13 13 L6 13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconChat(props: SvgProps) {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} {...props}>
      <path
        d="M3 4 L13 4 L13 11 L9 11 L6 14 L6 11 L3 11 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}