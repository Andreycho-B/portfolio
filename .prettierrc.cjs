/** @type {import("prettier").Config} */
module.exports = {
  plugins: [require.resolve("prettier-plugin-astro")],
  overrides: [
    {
      files: "*.astro",
      options: {
        parser: "astro",
        printWidth: 100,
        tabWidth: 2,
        useTabs: false,
        semi: true,
        singleQuote: false,
        trailingComma: "all",
        bracketSameLine: false,
      },
    },
  ],
};
