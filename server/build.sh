#!/bin/sh

cd www/js
java -Xmx1024m -classpath ../../java/rhino.jar:../../java/compiler.jar org.mozilla.javascript.tools.shell.Main /usr/local/bin/r.js -o app.build.js
