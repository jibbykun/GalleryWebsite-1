#!/usr/bin/env bash

set -e
echo beforeEach
#Delete the database files.
FILE=gallery.db
if test -f "$FILE"; then
    rm -rf gallery.db
fi