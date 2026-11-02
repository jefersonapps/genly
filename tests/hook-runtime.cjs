// Run the real hook's state and effect lifecycle while replacing native boundaries.
exports.hookRuntime = () => {
  const slots = [];
  let cursor, dirty, render, output, effects = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      const set = value => {
        const next = typeof value === 'function' ? value(slots[index]) : value;
        if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true; }
      };
      return [slots[index], set];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ||= { current: initial };
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || !deps || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  const flush = nextRender => {
    if (nextRender) render = nextRender;
    let attempts = 0;
    do {
      if (++attempts > 30) throw new Error('Unexpected render loop');
      dirty = false; cursor = 0; effects = [];
      output = render();
      effects.forEach(effect => effect());
    } while (dirty);
    return output;
  };
  return { react, flush, result: () => output };
};
