import { gsap } from "gsap";
import type { ProjectItem } from "./project-data";

export interface TitleMorphNodes {
  readonly titleElement: HTMLElement;
  readonly yearElement: HTMLElement;
  readonly linkElement?: HTMLAnchorElement | null;
  readonly currentIdxElement: HTMLElement;
  readonly thumbBarElement: HTMLElement | null;
  readonly blurNode: SVGFEGaussianBlurElement | null;
}

export class ProjectTitleMorphController {
  private activeTimeline: gsap.core.Timeline | null = null;
  private currentId = "";
  private currentSlug = "";

  public get activeSlug(): string {
    return this.currentSlug || "mias-hamburguesas-de-lujo";
  }

  constructor(private readonly nodes: TitleMorphNodes) {}

  public transitionTo(project: ProjectItem, indexNumber: number, totalCount: number): void {
    if (this.currentId === project.id) return;
    this.currentId = project.id;
    this.currentSlug = project.slug;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced || !this.nodes.blurNode) {
      this.updateContent(project, indexNumber, totalCount);
      return;
    }

    if (this.activeTimeline) {
      this.activeTimeline.kill();
      this.nodes.titleElement.style.filter = "";
      this.nodes.blurNode.setAttribute("stdDeviation", "0 0");
    }

    const { titleElement, yearElement, blurNode } = this.nodes;
    titleElement.style.filter = "url(#project-title-blur-filter)";

    const blurProxy = { blur: 0 };
    const tl = gsap.timeline({
      onComplete: () => {
        titleElement.style.filter = "";
        blurNode.setAttribute("stdDeviation", "0 0");
        this.activeTimeline = null;
      },
    });

    tl.to(
      blurProxy,
      {
        blur: 14,
        duration: 0.18,
        ease: "power2.in",
        onUpdate: () => {
          blurNode.setAttribute("stdDeviation", `${blurProxy.blur} ${blurProxy.blur}`);
        },
      },
      0,
    );

    tl.to(
      yearElement,
      {
        opacity: 0,
        y: -4,
        duration: 0.14,
        ease: "power1.in",
      },
      0,
    );

    tl.add(() => {
      this.updateContent(project, indexNumber, totalCount);
    }, 0.18);

    tl.to(
      blurProxy,
      {
        blur: 0,
        duration: 0.34,
        ease: "power2.out",
        onUpdate: () => {
          blurNode.setAttribute("stdDeviation", `${blurProxy.blur} ${blurProxy.blur}`);
        },
      },
      0.18,
    );

    tl.to(
      yearElement,
      {
        opacity: 1,
        y: 0,
        duration: 0.28,
        ease: "power2.out",
      },
      0.2,
    );

    this.activeTimeline = tl;
  }

  private updateContent(project: ProjectItem, indexNumber: number, totalCount: number): void {
    this.nodes.titleElement.textContent = project.title;
    this.nodes.yearElement.textContent = project.year;
    this.nodes.currentIdxElement.textContent = `0${indexNumber + 1}`;
    if (this.nodes.linkElement) {
      this.nodes.linkElement.href = `/proyectos/${project.slug}`;
      this.nodes.linkElement.setAttribute("aria-label", `Ver proyecto ${project.title}`);
    }

    if (this.nodes.thumbBarElement) {
      this.nodes.thumbBarElement.style.width = `${100 / totalCount}%`;
      this.nodes.thumbBarElement.style.transform = `translateX(${indexNumber * 100}%)`;
    }
  }

  public destroy(): void {
    if (this.activeTimeline) {
      this.activeTimeline.kill();
      this.activeTimeline = null;
    }
  }
}
