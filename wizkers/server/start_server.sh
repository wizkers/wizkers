#!/bin/sh

# Export the NODE_PATH variable to tell node where to get its modules
export NODE_PATH=.

# Shortcut to (again) help node find the modules that are from the web
# root:
if [ ! -e app ]; then
    ln -s www/js/app .
fi

export DEBUG=wizkers:*

# Set the variable ENABLE_NOBLE to "1" to enable Bluetooth support in server mode
export ENABLE_NOBLE=1

node server.js