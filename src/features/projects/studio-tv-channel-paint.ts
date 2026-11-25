export const [TV_CH_W, TV_CH_H] = [768, 538];

const SMPTE_TOP = ["#c0c0c0", "#c0c000", "#00c0c0", "#00c000", "#c000c0", "#c00000", "#0000c0"];
const SMPTE_MID = ["#0000c0", "#131313", "#c000c0", "#131313", "#00c0c0", "#131313", "#c0c0c0"];
const SMPTE_BOT = ["#00214c", "#ffffff", "#32006a", "#131313", "#090909", "#1d1d1d", "#131313"];

export const paintSmpteChannel = (ctx: CanvasRenderingContext2D, elapsed: number): void => {
  const bw = TV_CH_W / 7;
  const topH = Math.round(TV_CH_H * 0.67);
  const midH = Math.round(TV_CH_H * 0.085);
  const botY = topH + midH;
  const botH = TV_CH_H - botY;
  for (let i = 0; i < 7; i += 1) {
    const x = Math.floor(i * bw);
    const w = Math.ceil(bw) + 1;
    ctx.fillStyle = SMPTE_TOP[i] ?? "#ffffff";
    ctx.fillRect(x, 0, w, topH);
    ctx.fillStyle = SMPTE_MID[i] ?? "#131313";
    ctx.fillRect(x, topH, w, midH);
    ctx.fillStyle = SMPTE_BOT[i] ?? "#131313";
    ctx.fillRect(x, botY, w, botH);
  }
  ctx.fillStyle = "rgba(10, 10, 12, 0.78)";
  ctx.fillRect(TV_CH_W * 0.5 - 178, TV_CH_H * 0.44 - 38, 356, 76);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
  ctx.lineWidth = 2;
  ctx.strokeRect(TV_CH_W * 0.5 - 178, TV_CH_H * 0.44 - 38, 356, 76);
  ctx.fillStyle = "#ffffff";
  ctx.font = '700 28px "Author", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ANDREY · STUDIO TV", TV_CH_W * 0.5, TV_CH_H * 0.44 - 8);
  ctx.font = '400 15px "Karrik", monospace';
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  const dot = Math.floor(elapsed * 2) % 2 === 0 ? "● " : "○ ";
  ctx.fillText(`${dot}DUITAMA · COLOMBIA`, TV_CH_W * 0.5, TV_CH_H * 0.44 + 19);
};

export const paintTerminalChannel = (ctx: CanvasRenderingContext2D, elapsed: number): void => {
  ctx.fillStyle = "#041108";
  ctx.fillRect(0, 0, TV_CH_W, TV_CH_H);
  ctx.font = '600 22px "Karrik", monospace';
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const cursor = Math.floor(elapsed * 2) % 2 === 0 ? "█" : "";
  const lines = [
    "ANDREY OS // CRT STUDIO v1.0",
    "────────────────────────────────────",
    "> ROLE       : CREATIVE FULLSTACK DEV",
    "> STACK      : ASTRO · TS · THREE.JS · GSAP",
    "> PROJECTS   : MIAS · TU SUPER · ESTANDAR",
    "> ENGINE     : WEBGL2 + PBR + CRT SHADER",
    "> AUDIO      : PROCEDURAL WEB AUDIO API",
    "> STATUS     : ONLINE · READY TO BUILD",
    "",
    `> _${cursor}`,
  ];
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillStyle = i === 0 ? "#aaffc6" : "#52ee8b";
    ctx.fillText(lines[i] ?? "", 56, 78 + i * 38);
  }
};

const RESOLVED_TZ = (Intl.DateTimeFormat().resolvedOptions().timeZone || "LOCAL").toUpperCase();
let cachedClockDayKey = -1;
let cachedClockDateLabel = "";

export const paintClockChannel = (ctx: CanvasRenderingContext2D): void => {
  ctx.fillStyle = "#0a0c12";
  ctx.fillRect(0, 0, TV_CH_W, TV_CH_H);
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const dayKey = now.getFullYear() * 10000 + now.getMonth() * 100 + now.getDate();
  if (dayKey !== cachedClockDayKey) {
    cachedClockDayKey = dayKey;
    cachedClockDateLabel = now
      .toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })
      .toUpperCase();
  }
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '900 116px "Author", monospace';
  ctx.fillText(`${hh}:${mm}:${ss}`, TV_CH_W * 0.5, TV_CH_H * 0.46);
  ctx.font = '500 22px "Karrik", sans-serif';
  ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
  ctx.fillText(cachedClockDateLabel, TV_CH_W * 0.5, TV_CH_H * 0.66);
  ctx.font = '400 17px "Karrik", monospace';
  ctx.fillStyle = "#68ff98";
  ctx.fillText(`ZONA HORARIA · ${RESOLVED_TZ}`, TV_CH_W * 0.5, TV_CH_H * 0.76);
};
