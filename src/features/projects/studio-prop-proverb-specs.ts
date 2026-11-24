import type { StudioFocusPropId } from "./studio-prop-focus";

export interface PropProverbEntrySpec {
  readonly lines: readonly string[];
  readonly desktopPos: readonly [number, number, number];
  readonly mobilePos: readonly [number, number, number];
  readonly align: CanvasTextAlign;
}

export interface PropProverbGroupSpec {
  readonly propId: StudioFocusPropId;
  readonly name: string;
  readonly anchor: readonly [number, number, number];
  readonly yawRad: number;
  readonly planeWidth: number;
  readonly desktopFontPx: number;
  readonly mobileFontPx: number;
  readonly joinOnMobile: boolean;
  readonly entries: readonly PropProverbEntrySpec[];
}

export const PROP_PROVERB_GROUPS: readonly PropProverbGroupSpec[] = [
  {
    propId: "clock",
    name: "studioClockProverbs3D",
    anchor: [-1.84, -0.84, 0.46],
    yawRad: 0.28,
    planeWidth: 0.56,
    desktopFontPx: 74,
    mobileFontPx: 58,
    joinOnMobile: true,
    entries: [
      {
        lines: ["Al mal tiempo", "buena cara"],
        desktopPos: [-0.88, -0.02, 0.18],
        mobilePos: [0, 0.56, 0.16],
        align: "right",
      },
      {
        lines: ["Al que madruga", "Dios le ayuda"],
        desktopPos: [0.88, -0.02, 0.18],
        mobilePos: [0, -0.56, 0.16],
        align: "left",
      },
    ],
  },
  {
    propId: "thermos",
    name: "studioThermosProverbs3D",
    anchor: [2.28, -0.62, 1.05],
    yawRad: 0.03,
    planeWidth: 0.68,
    desktopFontPx: 66,
    mobileFontPx: 66,
    joinOnMobile: false,
    entries: [
      {
        lines: ["No esperes a tener sed", "para tomar agua"],
        desktopPos: [0.72, 0.17, 0.04],
        mobilePos: [0, 0.84, 0.04],
        align: "left",
      },
      {
        lines: ["Si agua sola es tu bebida,", "será más larga tu vida"],
        desktopPos: [0.72, -0.17, 0.04],
        mobilePos: [0, -0.84, 0.04],
        align: "left",
      },
    ],
  },
  {
    propId: "bust",
    name: "studioBustProverbs3D",
    anchor: [2.18, -0.44, -0.28],
    yawRad: 0.58,
    planeWidth: 0.88,
    desktopFontPx: 46,
    mobileFontPx: 46,
    joinOnMobile: false,
    entries: [
      {
        lines: ["El ignorante afirma,", "el sabio duda y reflexiona"],
        desktopPos: [0.88, 0.52, 0.06],
        mobilePos: [0, 1.24, 0.06],
        align: "left",
      },
      {
        lines: [
          "[Proverbios 16:16]",
          "«Mejor es adquirir sabiduría",
          "que oro preciado; y adquirir",
          "inteligencia vale más que la plata»",
        ],
        desktopPos: [0.88, 0.06, 0.06],
        mobilePos: [0, 0.92, 0.06],
        align: "left",
      },
      {
        lines: [
          "[Santiago 1:5]",
          "«Si a alguno de ustedes le falta sabiduría,",
          "pídasela a Dios, y él se la dará,",
          "pues Dios da a todos generosamente».",
        ],
        desktopPos: [0.88, -0.46, 0.06],
        mobilePos: [0, -1.08, 0.06],
        align: "left",
      },
    ],
  },
  {
    propId: "computer",
    name: "studioComputerProverbs3D",
    anchor: [-2.3, -0.7, -0.3],
    yawRad: -0.46,
    planeWidth: 0.82,
    desktopFontPx: 64,
    mobileFontPx: 60,
    joinOnMobile: false,
    entries: [
      {
        lines: ["Lo simple perdura,", "lo honesto trasciende"],
        desktopPos: [-0.94, 0.14, 0.06],
        mobilePos: [0, 0.86, 0.06],
        align: "right",
      },
    ],
  },
  {
    propId: "chair",
    name: "studioChairProverbs3D",
    anchor: [0.16, 2.1, 0.08],
    yawRad: -0.476,
    planeWidth: 3.5,
    desktopFontPx: 62,
    mobileFontPx: 58,
    joinOnMobile: false,
    entries: [
      {
        lines: ["Relájate, respira profundo.  :)"],
        desktopPos: [0, 0, 0],
        mobilePos: [0, 0, 0],
        align: "center",
      },
    ],
  },
];
