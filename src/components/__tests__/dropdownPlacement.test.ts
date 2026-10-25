import { placeDropdown } from '../dropdownPlacement';

const SCREEN = { width: 360, height: 800 };
const EDGES = { top: 32, bottom: 24, side: 8 };
const field = (y: number) => ({ x: 16, y, width: 328, height: 44 });

describe('placeDropdown', () => {
  it('opens under the field, as wide as the field', () => {
    expect(placeDropdown(field(200), SCREEN, 200, EDGES)).toEqual({ left: 16, width: 328, maxHeight: 200, top: 248 });
  });

  it('opens over the field when the list does not fit below and there is more room above', () => {
    const placement = placeDropdown(field(700), SCREEN, 300, EDGES);
    expect(placement).toEqual({ left: 16, width: 328, maxHeight: 300, bottom: 104 });
    expect(placement.top).toBeUndefined();
  });

  it('stays below and scrolls when neither side fits the whole list but below has more room', () => {
    const placement = placeDropdown(field(300), { width: 360, height: 640 }, 500, EDGES);
    expect(placement.top).toBe(348);
    expect(placement.maxHeight).toBe(640 - 24 - 344 - 4); // the room under the field, less the gap
  });

  it('keeps the list inside the side margins', () => {
    const wide = placeDropdown({ x: 300, y: 100, width: 200, height: 44 }, SCREEN, 100, EDGES);
    expect(wide.width).toBe(200);
    expect(wide.left).toBe(360 - 8 - 200);

    const off = placeDropdown({ x: -40, y: 100, width: 500, height: 44 }, SCREEN, 100, EDGES);
    expect(off).toMatchObject({ left: 8, width: 344 });
  });

  it('never reports a negative height', () => {
    expect(placeDropdown(field(790), SCREEN, 100, EDGES).maxHeight).toBeGreaterThanOrEqual(0);
  });
});
