export type SlotPosition = number;
export type SlotOffset = number;

interface DragSample {
  slot: SlotPosition;
  timeMs: number;
}

const DAMPING_PER_SECOND = 6.2;
const REST_EPSILON = 0.0005;
const VELOCITY_SMOOTHING_PER_SECOND = 12;
const SNAP_PROJECTION_SECONDS = 0.35;
const SNAP_PROJECTION_MAX_SLOTS = 1.8;
const THROW_WINDOW_MS = 120;
const THROW_IDLE_TIMEOUT_MS = 100;
const MIN_THROW_SPAN_SECONDS = 0.012;

export class DrumScrollPhysics {
  private currentSlot: SlotPosition = 0;
  private targetSlot: SlotPosition = 0;
  private slotVelocity = 0;
  private prefersReducedMotion = false;
  private isDragging = false;
  private lastDragSlot: SlotPosition = 0;
  private dragSamples: DragSample[] = [];
  private readonly motionQuery: MediaQueryList | null;

  constructor() {
    if (typeof window !== "undefined") {
      this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.prefersReducedMotion = this.motionQuery.matches;
      this.motionQuery.addEventListener("change", this.handleMotionChange);
    } else {
      this.motionQuery = null;
    }
  }

  public get currentPosition(): SlotPosition {
    return this.currentSlot;
  }

  public get targetPosition(): SlotPosition {
    return this.targetSlot;
  }

  public get scrollVelocity(): number {
    return this.slotVelocity;
  }

  public addDeltaSlots(deltaSlots: SlotOffset): void {
    this.targetSlot += deltaSlots;
  }

  public setTargetSlot(targetSlot: SlotPosition): void {
    this.targetSlot = targetSlot;
  }

  public stepSlots(step: SlotOffset): void {
    this.targetSlot = Math.round(this.targetSlot) + step;
  }

  public snapToNearestSlot(): void {
    const projectedOffset = Math.max(
      -SNAP_PROJECTION_MAX_SLOTS,
      Math.min(SNAP_PROJECTION_MAX_SLOTS, this.slotVelocity * SNAP_PROJECTION_SECONDS),
    );
    this.targetSlot = Math.round(this.targetSlot + projectedOffset);
  }

  public settleInstantly(): void {
    this.currentSlot = this.targetSlot;
    this.slotVelocity = 0;
  }

  public setInitialPosition(slot: SlotPosition): void {
    this.currentSlot = slot;
    this.targetSlot = 0;
    this.slotVelocity = 0;
  }

  public addContinuousDrift(deltaSlots: SlotOffset): void {
    if (this.prefersReducedMotion) return;
    this.currentSlot += deltaSlots;
    this.targetSlot += deltaSlots;
  }

  public beginDrag(): void {
    this.isDragging = true;
    this.targetSlot = this.currentSlot;
    this.lastDragSlot = this.currentSlot;
    this.slotVelocity = 0;
    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    this.dragSamples = [{ slot: this.currentSlot, timeMs: nowMs }];
  }

  public setDirectPosition(slot: SlotPosition): void {
    this.currentSlot = slot;
    this.targetSlot = slot;
    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    this.dragSamples.push({ slot, timeMs: nowMs });
    const cutoff = nowMs - THROW_WINDOW_MS;
    while (this.dragSamples.length > 1 && (this.dragSamples[0]?.timeMs ?? 0) < cutoff) {
      this.dragSamples.shift();
    }
  }

  public endDrag(): void {
    this.isDragging = false;
    this.lastDragSlot = this.currentSlot;
    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    const lastSample = this.dragSamples[this.dragSamples.length - 1];
    if (!lastSample || nowMs - lastSample.timeMs > THROW_IDLE_TIMEOUT_MS) {
      this.slotVelocity = 0;
      this.dragSamples = [];
      return;
    }
    const cutoff = nowMs - THROW_WINDOW_MS;
    while (this.dragSamples.length > 1 && (this.dragSamples[0]?.timeMs ?? 0) < cutoff) {
      this.dragSamples.shift();
    }
    const firstSample = this.dragSamples[0];
    if (firstSample && lastSample !== firstSample) {
      const elapsedSeconds = (lastSample.timeMs - firstSample.timeMs) / 1000;
      if (elapsedSeconds >= MIN_THROW_SPAN_SECONDS) {
        this.slotVelocity = (lastSample.slot - firstSample.slot) / elapsedSeconds;
      } else {
        this.slotVelocity = 0;
      }
    } else {
      this.slotVelocity = 0;
    }
    this.dragSamples = [];
  }

  public update(deltaSeconds: number): boolean {
    if (this.prefersReducedMotion) {
      this.settleInstantly();
      return true;
    }
    if (this.isDragging) {
      if (deltaSeconds > 0) {
        const instantVelocity = (this.currentSlot - this.lastDragSlot) / deltaSeconds;
        this.slotVelocity +=
          (instantVelocity - this.slotVelocity) *
          (1 - Math.exp(-VELOCITY_SMOOTHING_PER_SECOND * deltaSeconds));
        this.lastDragSlot = this.currentSlot;
      }
      return false;
    }
    if (deltaSeconds <= 0) {
      return Math.abs(this.targetSlot - this.currentSlot) < REST_EPSILON;
    }
    const previousSlot = this.currentSlot;
    const gap = this.targetSlot - this.currentSlot;
    this.currentSlot += gap * (1 - Math.exp(-DAMPING_PER_SECOND * deltaSeconds));
    if (Math.abs(this.targetSlot - this.currentSlot) < REST_EPSILON) {
      this.currentSlot = this.targetSlot;
    }
    const instantVelocity = (this.currentSlot - previousSlot) / deltaSeconds;
    this.slotVelocity +=
      (instantVelocity - this.slotVelocity) *
      (1 - Math.exp(-VELOCITY_SMOOTHING_PER_SECOND * deltaSeconds));
    return this.currentSlot === this.targetSlot;
  }

  public dispose(): void {
    this.motionQuery?.removeEventListener("change", this.handleMotionChange);
  }

  private readonly handleMotionChange = (): void => {
    const query = this.motionQuery;
    if (!query) return;
    this.prefersReducedMotion = query.matches;
    if (query.matches) this.settleInstantly();
  };
}
