import {
  type FluidTransitionOptions,
  navigateWithFluidWipe,
} from "../transitions/fluid-transition-controller";

export type CurtainTransitionOptions = FluidTransitionOptions;

export const navigateWithCurtain = (options: CurtainTransitionOptions): void => {
  navigateWithFluidWipe(options);
};
