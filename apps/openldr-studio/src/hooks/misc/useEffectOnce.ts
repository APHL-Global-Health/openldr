import { type EffectCallback, useEffect } from "react";

const useEffectOnce = (effect: EffectCallback) => {
  useEffect(() => {
    effect();
  }, [effect]);
};

export default useEffectOnce;
