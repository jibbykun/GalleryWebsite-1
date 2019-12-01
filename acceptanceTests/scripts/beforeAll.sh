#!/usr/bin/env bash

set -e
echo beforeAll

#Make backups of the databases.
FILE=gallery.db
if test -f "$FILE"; then
    cp gallery.db galleryBackup.db
    rm -rf gallery.db
fi

