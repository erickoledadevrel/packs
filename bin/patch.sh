#!/bin/bash

# Work around error when building the Holidays Pack.
find ./node_modules/astronomia/lib -type f | xargs sed -i.bak 's/let /var /g'

# Work around issue with lazy-cache
# find ./node_modules -type f -name 'package.json' \
#   | xargs grep -l 'lazy-cache' \
#   | xargs -I{} dirname {} \
#   | grep -v '/node_modules/lazy-cache' \
#   | xargs -I{} find {} -type f -name '*.js' \
#   | xargs grep -l "lazy-cache" \
#   | xargs sed -i.bak -E "s/require\('([^']+)'\)/require['\1'] = require('\1')/g ; s/require\('([^']+)', *'([^']+)'\)/require['\2'] = require('\1')/g"
# sed -E -i.bak "s/require\('([^']+)', *'([^']+)'\)/require['\2'] = require('\1')/g" node_modules/log-utils/index.js