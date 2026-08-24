export function creatureAnimationTransition(previousView, nextView) {
  const previousAnimationOn = previousView?.animation === 'on';
  const animationOn = nextView?.animation === 'on';
  return {
    animationOn,
    requiresReprepare: previousView != null && previousAnimationOn !== animationOn,
  };
}
