// The table renders on demand (only when something changes). kick() asks for another frame and,
// unless told otherwise, for the shadows to be recomputed because something moved.
import { useThree } from '@react-three/fiber';
import { useCallback } from 'react';

export function useKick() {
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  return useCallback(
    (moved = true) => {
      if (moved) gl.shadowMap.needsUpdate = true;
      invalidate();
    },
    [gl, invalidate],
  );
}
