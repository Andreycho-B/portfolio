import { getAudioSystem } from "../../core/audio";
import { getCursorController } from "../../design-system/components/cursor-controller";
import {
  bindDrumEvents,
  consumeDetentStep,
  type DrumControllerElements,
  isPointOverCard,
  observeCanvasResize,
} from "./drum.types";
import { DrumAutoplayController } from "./drum-autoplay";
import { DrumScrollPhysics } from "./drum-scroll-physics";
import { PROJECT_COUNT, PROJECTS } from "./project-data";

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
  private canvasRect: DOMRect;
  private readonly unbindEvents: () => void;
  private readonly unbindResize: () => void;
  private readonly audio = getAudioSystem();
  private readonly cursor = getCursorController();

  constructor(private readonly els: DrumControllerElements) {
    this.canvasRect = els.canvas.getBoundingClientRect();
    this.unbindEvents = bindDrumEvents(els.root, els.viewport, {
      onWheel: this.handleWheel,
      onKeyDown: this.handleKeyDown,
      onPointerDown: this.handlePointerDown,
      onPointerMove: this.handlePointerMove,
      onPointerUp: this.handlePointerUp,
      onPointerLeave: this.handlePointerLeave,
    });
    this.els.webglScene?.resize(this.els.canvas.clientWidth, this.els.canvas.clientHeight);
    this.unbindResize = observeCanvasResize(els.canvas, (rect) => {
      this.canvasRect = rect;
      this.els.webglScene?.resize(this.els.canvas.clientWidth, this.els.canvas.clientHeight);
      this.requestFrame();
    });
    this.syncActiveProject();
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
    const raw = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * CFG.lineH : e.deltaY;
    const delta = raw / CFG.wheel;
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
      if (e.pointerType === "mouse") {
        this.setCardHover(
          isPointOverCard(e.clientX, e.clientY, this.canvasRect, this.els.webglScene),
        );
      }
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
    const overCard = isPointOverCard(e.clientX, e.clientY, this.canvasRect, this.els.webglScene);
    if (isClick && gap < 0.25) {
      if (overCard) {
        this.els.onOpenActive();
      } else {
        const step = e.clientY < this.canvasRect.top + this.canvasRect.height / 2 ? -1 : 1;
        this.autoplay.notifyUserInteraction(step);
        this.physics.stepSlots(step);
        this.requestFrame();
      }
      return;
    }
    this.physics.snapToNearestSlot();
    if (e.pointerType === "mouse") this.setCardHover(overCard);
    this.requestFrame();
  };
  private readonly handleKeyDown = (e: KeyboardEvent): void => {
    const active = document.activeElement;
    if (active !== this.els.viewport && !this.els.root.contains(active)) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.els.onOpenActive();
      return;
    }
    const dir = this.physics.applyKeyNavigation(e.key, PROJECT_COUNT);
    if (dir !== 0) {
      e.preventDefault();
      this.autoplay.notifyUserInteraction(dir);
      this.requestFrame();
    }
  };
  private syncActiveProject(): void {
    const index =
      ((Math.round(this.physics.currentPosition) % PROJECT_COUNT) + PROJECT_COUNT) % PROJECT_COUNT;
    if (index === this.activeIndex) return;
    this.activeIndex = index;
    const project = PROJECTS[index];
    if (!project) return;
    this.els.morphController.transitionTo(project, index, PROJECT_COUNT);
    if (this.isHoveringCard) this.cursor.setInverted(project.theme === "dark");
  }
  public requestFrame(): void {
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
    const isAtRest =
      this.physics.update(dt) && this.drag.id === null && !this.autoplay.isDrifting();
    this.syncActiveProject();
    if (
      consumeDetentStep(this.physics.currentPosition, this.tickState) &&
      this.autoplay.isUserInteracting()
    ) {
      this.audio.playTactileFeedback("wheel_tick", this.physics.scrollVelocity);
    }
    this.els.webglScene?.setRotation(this.physics.currentPosition);
    this.els.webglScene?.setScrollVelocity(this.physics.scrollVelocity);
    this.els.webglScene?.render();
    this.needsRender = false;
    this.rafId = isAtRest && !this.needsRender ? null : requestAnimationFrame(this.tick);
  };
  public destroy(): void {
    if (this.isHoveringCard) this.setCardHover(false);
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.wheelSnapTimer !== null) window.clearTimeout(this.wheelSnapTimer);
    this.unbindEvents();
    this.unbindResize();
    this.autoplay.dispose();
    this.els.morphController.destroy();
    this.els.webglScene?.dispose();
    this.physics.dispose();
  }
}
