import { COLORS } from "./src/utils/colors";

/** @type {import('tailwindcss').Config} */
export const content = ["./index.html", "./src/**/*.{js,ts,jsx,tsx,css,md,mdx,html,json,scss}"];
export const darkMode = "class";
export const theme = {
  colors: COLORS,
  extend: {
    animation: {
      marquee: "marquee 25s linear infinite",
      marquee2: "marquee2 25s linear infinite",
    },
    keyframes: {
      marquee: {
        "0%": { transform: "translateX(0%)" },
        "100%": { transform: "translateX(-100%)" },
      },
      marquee2: {
        "0%": { transform: "translateX(100%)" },
        "100%": { transform: "translateX(0%)" },
      },
    },
    fontFamily: {
      primary: "DM Sans",
      title: "Unique",
    },
    fontSize: {
      md: "1rem",
    },
    width: {
      128: "32rem",
      256: "64rem",
    },
  },
};
export const plugins = [];
