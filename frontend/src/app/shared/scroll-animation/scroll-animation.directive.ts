import { Directive, ElementRef, Input, OnInit, OnDestroy } from '@angular/core';

export type ScrollAnimation = 'fade-up' | 'fade-down' | 'fade-left' | 'fade-right' | 'zoom-in';

@Directive({
  selector: '[appScrollAnimation]',
  standalone: true,
})
export class ScrollAnimationDirective implements OnInit, OnDestroy {
  @Input('appScrollAnimation') animation: ScrollAnimation = 'fade-up';
  @Input() scrollDelay: number = 0;
  @Input() scrollDuration: number = 600;

  private observer: IntersectionObserver | null = null;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    // Start invisible
    const element = this.el.nativeElement;
    element.style.opacity = '0';
    element.style.transition = `opacity ${this.scrollDuration}ms ease, transform ${this.scrollDuration}ms ease`;
    element.style.transitionDelay = `${this.scrollDelay}ms`;

    // Set initial transform based on animation type
    this.setInitialTransform(element);

    // Observe
    this.observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          element.style.opacity = '1';
          element.style.transform = 'translate(0, 0) scale(1)';
          this.observer?.unobserve(element);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    this.observer.observe(element);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private setInitialTransform(element: HTMLElement): void {
    switch (this.animation) {
      case 'fade-up':
        element.style.transform = 'translateY(40px)';
        break;
      case 'fade-down':
        element.style.transform = 'translateY(-40px)';
        break;
      case 'fade-left':
        element.style.transform = 'translateX(-40px)';
        break;
      case 'fade-right':
        element.style.transform = 'translateX(40px)';
        break;
      case 'zoom-in':
        element.style.transform = 'scale(0.9)';
        break;
    }
  }
}
