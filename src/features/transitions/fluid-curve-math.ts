const VIEWBOX_SIZE = 100;
const CTRL_X_LEFT = 35;
const CTRL_X_RIGHT = 65;

const clampUnit = (value: number): number => Math.max(0, Math.min(1, value));

export const calculateSweepInPath = (progress: number, tension = 0.85): string => {
  const p = clampUnit(progress);
  const baseSidesY = VIEWBOX_SIZE * (1 - p);
  const fluidBulge = Math.sin(p * Math.PI) * 38 * Math.max(0, Math.min(1.5, tension));
  const leadingY = Math.max(0, baseSidesY - fluidBulge);

  return (
    `M 0 ${baseSidesY.toFixed(2)} ` +
    `C ${CTRL_X_LEFT} ${leadingY.toFixed(2)}, ` +
    `${CTRL_X_RIGHT} ${leadingY.toFixed(2)}, ` +
    `${VIEWBOX_SIZE} ${baseSidesY.toFixed(2)} ` +
    `L ${VIEWBOX_SIZE} ${VIEWBOX_SIZE} ` +
    `L 0 ${VIEWBOX_SIZE} Z`
  );
};

export const calculateSweepOutPath = (progress: number, tension = 0.85): string => {
  const p = clampUnit(progress);
  const baseSidesY = VIEWBOX_SIZE * (1 - p);
  const fluidBulge = Math.sin(p * Math.PI) * 38 * Math.max(0, Math.min(1.5, tension));
  const trailingY = Math.max(0, baseSidesY - fluidBulge);

  return (
    `M 0 0 ` +
    `L ${VIEWBOX_SIZE} 0 ` +
    `L ${VIEWBOX_SIZE} ${baseSidesY.toFixed(2)} ` +
    `C ${CTRL_X_RIGHT} ${trailingY.toFixed(2)}, ` +
    `${CTRL_X_LEFT} ${trailingY.toFixed(2)}, ` +
    `0 ${baseSidesY.toFixed(2)} Z`
  );
};

export const getFullCoverPath = (): string =>
  `M 0 0 L ${VIEWBOX_SIZE} 0 L ${VIEWBOX_SIZE} ${VIEWBOX_SIZE} L 0 ${VIEWBOX_SIZE} Z`;

export const getHiddenBottomPath = (): string =>
  `M 0 ${VIEWBOX_SIZE} L ${VIEWBOX_SIZE} ${VIEWBOX_SIZE} L ${VIEWBOX_SIZE} ${VIEWBOX_SIZE} L 0 ${VIEWBOX_SIZE} Z`;
