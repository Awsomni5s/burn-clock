.PHONY: reproduce dev build test
# Requires Node 22+, Python 3.10+, npm ci, and npx playwright install chromium.
# Reconstructs all finite UI reference states from supplied outputs; upstream raw
# FIRMS/Parquet and original contour generation cannot be rebuilt from this release.
reproduce:
	node scripts/reproduce.mjs
dev:
	npm run dev
build:
	npm run build
test:
	npm test
