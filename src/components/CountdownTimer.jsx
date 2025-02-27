import { useState, useEffect, memo } from "react";
import PropTypes from "prop-types";

const CountdownTimer = memo(({ initialCount, onComplete }) => {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    setCount(initialCount); // reset when initialCount changes
    const intervalId = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          onComplete && onComplete();
          return initialCount; // or you can return 0 if preferred
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [initialCount, onComplete]);

  return <>{count}</>;
});

CountdownTimer.displayName = "CountdownTimer";

CountdownTimer.propTypes = {
  initialCount: PropTypes.number.isRequired,
  onComplete: PropTypes.func,
};

export default CountdownTimer;
