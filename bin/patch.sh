#!/bin/bash

# Work around error when building the Holidays Pack.
find ./node_modules/astronomia/lib -type f | xargs sed -i.bak 's/let /var /g'
