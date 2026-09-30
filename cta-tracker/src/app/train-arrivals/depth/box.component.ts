import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * A CSS cuboid: the element it is put on is the footprint on the ground, and it grows five faces —
 * top, the four sides, no bottom — `--h` tall, shaded from `--c`. Lifted off the ground by `--z0`.
 *
 * An attribute component so the footprint stays whatever element the parent positions, with no
 * wrapper in between to break `preserve-3d`.
 */
@Component({
  selector: '[appBox]',
  template: '<i class="t"></i><i class="n"></i><i class="s"></i><i class="w"></i><i class="e"></i>',
  styles: `
    :host {
      position: absolute;
      transform-style: preserve-3d;
      transform: translateZ(var(--z0, 0px));
    }
    i { position: absolute; display: block; }
    /* Lit from the south-east: the top brightest, the south face the colour itself, the rest darker. */
    .t { inset: 0; transform: translateZ(var(--h)); background: var(--top, color-mix(in srgb, var(--c), white 22%)); }
    .s { left: 0; right: 0; bottom: 0; height: var(--h); transform-origin: bottom; transform: rotateX(-90deg); background: var(--front, var(--c)); }
    .n { left: 0; right: 0; top: 0; height: var(--h); transform-origin: top; transform: rotateX(90deg); background: color-mix(in srgb, var(--c), black 38%); }
    .e { top: 0; bottom: 0; right: 0; width: var(--h); transform-origin: right; transform: rotateY(90deg); background: color-mix(in srgb, var(--c), black 20%); }
    .w { top: 0; bottom: 0; left: 0; width: var(--h); transform-origin: left; transform: rotateY(-90deg); background: color-mix(in srgb, var(--c), black 30%); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BoxComponent {}
