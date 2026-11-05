# Compiling the styles

The site loads `styles/main.css`, which is compiled from `styles/main.scss` and the
partials in `styles/scss/`. Nothing compiles it on push (`.github/workflows/sass.yml_`
is disabled), so compile locally and commit `main.css` and `main.css.map` with your
SCSS changes.

## One-off compile

```bash
npx sass styles/main.scss styles/main.css
```

## Watch while editing

```bash
npx sass --watch styles/main.scss styles/main.css
```

The VS Code "Live Sass Compiler" extension works too; point it at the same output path.
