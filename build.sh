#!/bin/sh
# Transpile JSX -> plain JS so the browser doesn't need Babel at runtime.
# RUN THIS after editing any .jsx file, then commit the generated .js files.
#   ./build.sh
set -e
cd "$(dirname "$0")"
ES="npx --yes esbuild@0.25.9"
$ES trip-icons.jsx --outfile=trip-icons.js --target=es2019 --log-level=warning
$ES trip-app.jsx   --outfile=trip-app.js   --target=es2019 --log-level=warning
echo "Built trip-icons.js + trip-app.js"
