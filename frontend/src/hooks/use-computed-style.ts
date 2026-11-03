import { useEffect, useState } from "react";
import Cookies from "js-cookie";

export default function useComputedStyle(property: string) {
  const [style, setStyle] = useState("");
  const theme = Cookies.get("theme");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const computedStyle = window
        .getComputedStyle(document.body)
        .getPropertyValue(property)
        .trim();

      setStyle(computedStyle);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [property, theme]);

  return style;
}
