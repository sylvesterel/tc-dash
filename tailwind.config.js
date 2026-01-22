/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./public/**/*.html",
    "./protected/**/*.html",
    "./public/js/**/*.js"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#137fec",
        "background-light": "#f6f7f8",
        "background-dark": "#101922",
        "card-dark": "#1c232d",
        "card-hover": "#252f3a",
        "secondary-text": "#9dabb9",
        "sluse-brown": "#863b0ca2",
        "sluse-yellow": "#b4f5008e"
      },
      fontFamily: {
        "display": ["Inter", "sans-serif"]
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      }
    },
  },
  plugins: [],
}
