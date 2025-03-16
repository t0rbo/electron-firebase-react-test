/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./index.html"
  ],
  theme: {},
  plugins: [],
  // Purge unused styles
  purge: {
    enabled: process.env.NODE_ENV === "production",
    content: ["./src/**/*.{js,jsx,ts,tsx}", "./index.html"],
    options: {
      safelist: [
        /^bg-/,
        /^text-/,
        /^border-/,
        // Add other dynamic classes
      ],
    },
  },
}; 