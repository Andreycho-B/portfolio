import {
  type FluidTransitionOptions,
  navigateWithFluidWipe,
} from "../transitions/fluid-transition-controller";

type CurtainTransitionOptions = FluidTransitionOptions;

export const navigateWithCurtain = (options: CurtainTransitionOptions): void => {
  navigateWithFluidWipe(options);
};
