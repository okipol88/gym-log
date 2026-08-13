# Gym Log

Static workout dashboard for GitHub Pages.

## Data

`data/workouts.jsonl` stores one workout session per line as JSON.

## GitHub Pages

The repository includes `.github/workflows/pages.yml`. In repository **Settings → Pages**, set **Source** to **GitHub Actions**. After that, pushes to `main` deploy the page automatically.

The dashboard shows the bench goal, estimated 1RM trend, latest-session volume, exercise filtering, and workout details.
