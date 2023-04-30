#!/bin/bash

# Work around error when building the Holidays Pack.
find ./node_modules/astronomia/lib -type f | xargs sed -i  's/let /var /g'
