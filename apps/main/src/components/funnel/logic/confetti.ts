const COLORS = ['#a07a3c', '#14202b', '#c9a86a', '#5980a6', '#d8c8a8'];

/**
 * The 46 confetti pieces of the booking confirmation, ported from the prototype: a seeded sine "random" so every
 * visitor sees the same shower. Each string is the piece's inline style (the confettiFall keyframes live in globals.css).
 * Positions are physical on purpose (noflip): the shower is symmetrical and falls the same in both directions.
 */
export function confettiStyles(count = 46): string[] {
  return Array.from({ length: count }, (_, i) => {
    const r = (n: number) => {
      const x = Math.sin((i + 1) * n) * 10000;
      return x - Math.floor(x);
    };
    const round = r(3) > 0.6;
    return (
      'position: absolute; top: -24px; left: ' + (r(1) * 100).toFixed(2) + '%; width: ' + (round ? 8 : 6) + 'px; height: ' +
      (round ? 8 : 13) + 'px; border-radius: ' + (round ? '50%' : '1px') + '; background: ' + COLORS[Math.floor(r(2) * COLORS.length)] +
      '; opacity: ' + (0.75 + r(5) * 0.25).toFixed(2) + '; --dx: ' + ((r(4) - 0.5) * 260).toFixed(0) + 'px; --rot: ' +
      (360 + r(6) * 900).toFixed(0) + 'deg; animation: confettiFall ' + (2.6 + r(7) * 2.2).toFixed(2) + 's cubic-bezier(0.25,0.6,0.4,1) ' +
      (r(8) * 0.9).toFixed(2) + 's forwards /* noflip */'
    );
  });
}
