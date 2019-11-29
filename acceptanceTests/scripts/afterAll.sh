#!/usr/bin/env bash

set -e
echo afterAll
#Delete the databases that were used for the acceptance testing.
FILE=gallery.db
if test -f "$FILE"; then
    rm -rf gallery.db
fi
#Restore the databases from before the acceptance tests were run, and delete the backups.
FILE=galleryBackup.db
if test -f "$FILE"; then
    cp galleryBackup.db gallery.db
    rm -rf galleryBackup.db
fi


