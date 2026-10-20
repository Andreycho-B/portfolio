import { getAudioSystem } from "../../core/audio";
import { getCursorController } from "../../design-system/components/cursor-controller";
import { DrumAutoplayController } from "./drum-autoplay";
import { DrumScrollPhysics } from "./drum-scroll-physics";
import { type DrumControllerElements, PROJECT_COUNT, PROJECTS } from "./project-data";

const CFG = { wheel: 180, drag: 180, snapIdle: 240, lineH: 16, clickTol: 6, label: "Ver" } as const;

export class ProjectDrumController {
  private readonly physics = new DrumScrollPhysics();
  private readonly autoplay = new DrumAutoplayController({ onWake: () => this.requestFrame() });
  private drag = { id: null as number | null, startY: 0, maxDist: 0, startTarget: 0 };
  private isHoveringCard = false;
  private wheelSnapTimer: number | null = null;
  private activeIndex = -1;
  private tickState = { prevPos: 0, lastDetentPos: 0 };
  private rafId: number | null = null;
  private lastFrameTime = 0;
  private needsRender = true;
  private readonly resizeObserver: ResizeObserver;
  private readonly audio = getAudioSystem();
  private readonly cursor = getCursorController();
  constructor(private readonly els: DrumControllerElements) {
    this.bindListeners(true);
    this.resizeObserver = new ResizeObserver(() => {
      els.webglScene.resize(els.canvas.clientWidth, els.canvas.clientHeight);
      this.requestFrame();
    });
    this.resizeObserver.observe(els.canvas);
    this.syncActiveProject();
    this.requestFrame();
  }
  private bindListeners(attach: boolean): void {
    const fn = attach ? "addEventListener" : "removeEventListener";
    const { root, viewport } = this.els;
    root[fn]("wheel", this.handleWheel as EventListener, { passive: false });
    window[fn]("keydown", this.handleKeyDown as EventListener);
    viewport[fn]("pointerdown", this.handlePointerDown as EventListener);
    viewport[fn]("pointermove", this.handlePointerMove as EventListener);
    viewport[fn]("pointerup", this.handlePointerUp as EventListener);
    viewport[fn]("pointercancel", this.handlePointerUp as EventListener);
    viewport[fn]("pointerleave", this.handlePointerLeave as EventListener);
  }
  public invalidate(): void {
    this.requestFrame();
  }
  public playIntroSettling(offsetSlots = -1.2): void {
    this.physics.setInitialPosition(offsetSlots);
    this.tickState = { prevPos: offsetSlots, lastDetentPos: Math.round(offsetSlots * 2) * 0.5 };
    this.syncActiveProject();
    this.requestFrame();
  }
  private readonly handleWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const delta =
      (e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * CFG.lineH : e.deltaY) / CFG.wheel;
    this.autoplay.notifyUserInteraction(delta);
    this.physics.addDeltaSlots(delta);
    if (this.wheelSnapTimer !== null) window.clearTimeout(this.wheelSnapTimer);
    this.wheelSnapTimer = window.setTimeout(() => {
      this.wheelSnapTimer = null;
      this.physics.snapToNearestSlot();
      this.requestFrame();
    }, CFG.snapIdle);
    this.requestFrame();
  };

  private isOverFrontCard(e: PointerEvent): boolean {
    const { widthRatio, heightRatio } = this.els.webglScene.getFrontCardBounds();
    const r = this.els.canvas.getBoundingClientRect();
    const dx = Math.abs(e.clientX - (r.left + r.width / 2));
    const dy = Math.abs(e.clientY - (r.top + r.height / 2));
    return dx <= (r.width * widthRatio) / 2 && dy <= (r.height * heightRatio) / 2;
  }
  private setCardHover(hover: boolean): void {
    if (hover === this.isHoveringCard) return;
    this.isHoveringCard = hover;
    this.cursor.setExpanded(hover, hover ? CFG.label : undefined);
    this.cursor.setInverted(hover && PROJECTS[this.activeIndex]?.theme === "dark");
    if (hover) this.audio.triggerProximityAura(0.75);
  }
  private readonly handlePointerLeave = (): void => {
    if (this.drag.id === null) this.setCardHover(false);
  };
  private readonly handlePointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 || this.drag.id !== null) return;
    this.autoplay.notifyUserInteraction();
    this.physics.beginDrag();
    this.drag = {
      id: e.pointerId,
      startY: e.clientY,
      maxDist: 0,
      startTarget: this.physics.currentPosition,
    };
    this.els.viewport.setPointerCapture(e.pointerId);
    this.cursor.setPressed(true);
  };
  private readonly handlePointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.drag.id) {
      if (e.pointerType === "mouse") this.setCardHover(this.isOverFrontCard(e));
      return;
    }
    const deltaY = e.clientY - this.drag.startY;
    this.drag.maxDist = Math.max(this.drag.maxDist, Math.abs(deltaY));
    this.physics.setDirectPosition(this.drag.startTarget - deltaY / CFG.drag);
    this.setCardHover(false);
    this.requestFrame();
  };
  private readonly handlePointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.drag.id) return;
    const isClick = this.drag.maxDist < CFG.clickTol && e.type === "pointerup";
    this.drag.id = null;
    this.cursor.setPressed(false);
    this.physics.endDrag();
    if (this.physics.scrollVelocity !== 0) {
      this.autoplay.setDirection(this.physics.scrollVelocity > 0 ? 1 : -1);
    }
    const gap = Math.abs(this.physics.targetPosition - this.physics.currentPosition);
    if (isClick && gap < 0.25) {
      if (this.isOverFrontCard(e)) {
        this.els.onOpenActive();
        return;
      }
      const r = this.els.canvas.getBoundingClientRect();
      const step = e.clientY < r.top + r.height / 2 ? -1 : 1;
      this.autoplay.notifyUserInteraction(step);
      this.physics.stepSlots(step);
      this.requestFrame();
      return;
    }
    this.physics.snapToNearestSlot();
    if (e.pointerType === "mouse") this.setCardHover(this.isOverFrontCard(e));
    this.requestFrame();
  };

  private readonly handleKeyDown = (e: KeyboardEvent): void => {
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    this.autoplay.notifyUserInteraction(step);
    this.physics.stepSlots(step);
    this.requestFrame();
  };

  private syncActiveProject(): void {
    const slot = Math.round(this.physics.currentPosition);
    const index = ((slot % PROJECT_COUNT) + PROJECT_COUNT) % PROJECT_COUNT;
    if (index === this.activeIndex) return;
    this.activeIndex = index;
    const project = PROJECTS[index];
    if (project) {
      this.els.morphController.transitionTo(project, index, PROJECT_COUNT);
      if (this.isHoveringCard) this.cursor.setInverted(project.theme === "dark");
    }
  }
  private syncAudioTick(): void {
    const curr = this.physics.currentPosition;
    const prev = this.tickState.prevPos;
    this.tickState.prevPos = curr;
    if (curr === prev) return;
    const detentStep = 0.5;
    const diff = curr - this.tickState.lastDetentPos;
    if (Math.abs(diff) >= detentStep) {
      const steps = Math.trunc(diff / detentStep);
      this.tickState.lastDetentPos += steps * detentStep;
      if (this.autoplay.isUserInteracting()) {
        this.audio.playTactileFeedback("wheel_tick", this.physics.scrollVelocity);
      }
    }
  }
  private requestFrame(): void {
    this.needsRender = true;
    if (this.rafId !== null) return;
    this.lastFrameTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number): void => {
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = now;
    const driftSlots = this.autoplay.update(dt, this.isHoveringCard);
    if (driftSlots !== 0) this.physics.addContinuousDrift(driftSlots);
    const isSettled = this.physics.update(dt);
    const isAtRest = isSettled && this.drag.id === null && !this.autoplay.isDrifting();
    this.syncActiveProject();
    this.syncAudioTick();
    this.els.webglScene.setRotation(this.physics.currentPosition);
    this.els.webglScene.setScrollVelocity(this.physics.scrollVelocity);
    this.els.webglScene.render();
    this.needsRender = false;
    this.rafId = isAtRest && !this.needsRender ? null : requestAnimationFrame(this.tick);
  };
  public destroy(): void {
    if (this.isHoveringCard) this.setCardHover(false);
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.wheelSnapTimer !== null) window.clearTimeout(this.wheelSnapTimer);
    this.bindListeners(false);
    this.resizeObserver.disconnect();
    this.autoplay.dispose();
    this.els.morphController.destroy();
    this.els.webglScene.dispose();
    this.physics.dispose();
  }
}
