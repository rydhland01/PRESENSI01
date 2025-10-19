# Presensi_PMC_CS01

Simple Flask-based attendance app ported from original static web version.

## Run locally / Replit

1. Install requirements:
```
pip install -r requirements.txt
```
2. Run:
```
python3 app.py
```
3. Open web URL shown by Replit or http://localhost:5000

Default admin account:
- username: `admin`
- password: `PMC2025!`

## Notes
- Photos saved into `static/uploads/`.
- Data saved into `data/users.json` and `data/absensi.json`.
- For GitHub Pages: GitHub Pages serves static sites only; to host this app from GitHub you need to deploy to a Python-capable host (Render, Heroku, Railway) or use GitHub Actions to deploy. Replit is recommended for quick testing.
