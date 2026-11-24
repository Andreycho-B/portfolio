export const hasVisibleColor = (color: string): boolean => {
  if (!color || color === "transparent") return false;
  const match = color.match(/rgba?\([^,]+,[^,]+,[^,]+(?:,\s*([\d.]+))?\)/);
  return match ? (match[1] === undefined ? true : Number.parseFloat(match[1]) > 0.005) : true;
};

export const traceRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void => {
  const rad = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
  ctx.beginPath();
  if (rad <= 0.25) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.roundRect(x, y, w, h, rad);
};

export const drawFittedImage = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  rect: DOMRect,
  fit: string,
): void => {
  if (!img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (fit === "cover" || fit === "contain") {
    const imgRatio = nw / nh;
    const boxRatio = rect.width / Math.max(1, rect.height);
    if (fit === "cover") {
      const sw = imgRatio > boxRatio ? nh * boxRatio : nw;
      const sh = imgRatio > boxRatio ? nh : nw / boxRatio;
      ctx.drawImage(
        img,
        (nw - sw) * 0.5,
        (nh - sh) * 0.5,
        sw,
        sh,
        rect.left,
        rect.top,
        rect.width,
        rect.height,
      );
      return;
    }
    const dw = imgRatio > boxRatio ? rect.width : rect.height * imgRatio;
    const dh = imgRatio > boxRatio ? rect.width / imgRatio : rect.height;
    ctx.drawImage(
      img,
      rect.left + (rect.width - dw) * 0.5,
      rect.top + (rect.height - dh) * 0.5,
      dw,
      dh,
    );
    return;
  }
  ctx.drawImage(img, rect.left, rect.top, rect.width, rect.height);
};

export const drawSvgElement = (
  ctx: CanvasRenderingContext2D,
  svg: SVGSVGElement,
  win: Window,
): void => {
  const rect = svg.getBoundingClientRect();
  if (rect.width <= 2 || rect.height <= 2) return;
  const shapes = svg.querySelectorAll<SVGGeometryElement>("path, circle");
  for (const shape of shapes) {
    const st = win.getComputedStyle(shape);
    const op = Number.parseFloat(st.opacity);
    if (st.display === "none" || st.visibility === "hidden" || op <= 0.01) continue;
    const tag = shape.tagName.toLowerCase();
    if (tag === "circle") {
      const cr = shape.getBoundingClientRect();
      if (
        cr.width > 0.5 &&
        cr.height > 0.5 &&
        st.fill &&
        st.fill !== "none" &&
        hasVisibleColor(st.fill)
      ) {
        ctx.save();
        ctx.globalAlpha *= op;
        ctx.beginPath();
        ctx.ellipse(
          cr.left + cr.width * 0.5,
          cr.top + cr.height * 0.5,
          cr.width * 0.5,
          cr.height * 0.5,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = st.fill;
        ctx.fill();
        ctx.restore();
      }
      continue;
    }
    const ctm = shape.getScreenCTM();
    const d = tag === "path" ? shape.getAttribute("d") : null;
    if (!ctm || !d) continue;
    ctx.save();
    ctx.globalAlpha *= op;
    ctx.transform(ctm.a, ctm.b, ctm.c, ctm.d, ctm.e, ctm.f);
    const path = new Path2D(d);
    if (st.fill && st.fill !== "none" && hasVisibleColor(st.fill)) {
      ctx.fillStyle = st.fill;
      ctx.fill(path);
    }
    if (st.stroke && st.stroke !== "none" && hasVisibleColor(st.stroke)) {
      ctx.strokeStyle = st.stroke;
      ctx.lineWidth = Number.parseFloat(st.strokeWidth) || 1;
      ctx.lineCap = (st.strokeLinecap as CanvasLineCap) || "round";
      ctx.lineJoin = (st.strokeLinejoin as CanvasLineJoin) || "round";
      ctx.stroke(path);
    }
    ctx.restore();
  }
};

const applyTextTransform = (text: string, transform: string): string => {
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  if (transform === "capitalize") return text.replace(/\b\w/g, (ch) => ch.toUpperCase());
  return text;
};

export const drawTextNode = (
  ctx: CanvasRenderingContext2D,
  node: Text,
  style: CSSStyleDeclaration,
  range: Range,
  viewW: number,
  viewH: number,
): void => {
  const raw = node.nodeValue;
  if (!raw?.trim()) return;
  range.selectNodeContents(node);
  const fullRect = range.getBoundingClientRect();
  if (
    fullRect.width <= 0 ||
    fullRect.height <= 0 ||
    fullRect.bottom < -12 ||
    fullRect.top > viewH + 12 ||
    fullRect.right < -12 ||
    fullRect.left > viewW + 12
  ) {
    return;
  }
  const fontSize = Number.parseFloat(style.fontSize) || 16;
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  ctx.fillStyle = style.color;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const transform = style.textTransform;

  const rects = range.getClientRects();
  if (rects.length <= 1) {
    const r = rects[0] ?? fullRect;
    const text = applyTextTransform(raw.replace(/\s+/g, " ").trim(), transform);
    if (text) ctx.fillText(text, r.left, r.top + r.height * 0.52);
    return;
  }

  let lineStart = 0;
  let lineTop = Number.NaN;
  let lineLeft = 0;
  let lineHeight = fontSize * 1.2;
  const flush = (endIdx: number): void => {
    const seg = applyTextTransform(
      raw.slice(lineStart, endIdx).replace(/\s+/g, " ").trim(),
      transform,
    );
    if (seg && Number.isFinite(lineTop)) ctx.fillText(seg, lineLeft, lineTop + lineHeight * 0.52);
  };
  const tokenRe = /\S+/g;
  let match: RegExpExecArray | null = tokenRe.exec(raw);
  while (match !== null) {
    range.setStart(node, match.index);
    range.setEnd(node, match.index + match[0].length);
    const wr = range.getBoundingClientRect();
    if (wr.width > 0 && wr.height > 0) {
      if (!Number.isFinite(lineTop)) {
        [lineStart, lineTop, lineLeft, lineHeight] = [match.index, wr.top, wr.left, wr.height];
      } else if (Math.abs(wr.top - lineTop) > fontSize * 0.45) {
        flush(match.index);
        [lineStart, lineTop, lineLeft, lineHeight] = [match.index, wr.top, wr.left, wr.height];
      }
    }
    match = tokenRe.exec(raw);
  }
  flush(raw.length);
};
