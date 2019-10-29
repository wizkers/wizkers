/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2018 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */


 /**
  * Take the 'official' smartcard_list.txt file and convert it into a javascript
  * array of objects that can be 'required' by Wizkers for identifying smartcards.
  */

const fs = require('fs');
const readline = require('readline');
const stream = require('stream');

var instream = fs.createReadStream('./smartcard_list.txt');
var instream2 = fs.createReadStream('./smartcard_list_wizkers.txt');
var outstream = new stream;
var jstream = fs.createWriteStream('./smartcard_list.js');

function parseLine(line) {

    if (line.match(/^[0-9A-Fa-f]+.*\s/)) {
        if (state ==0) {
            jstream.write('\n\t{\n\tatrs: [');
            state =1;
        }
        jstream.write('"' + line + '", ');
    } else if (line.match(/^\t{1}/)) {
        if (state == 1) {
            state = 2;
            jstream.write('],\n'); // Close ATR list
            jstream.write('\tcandidates: [ ');
        }
        // Card descriptions start with one tab
        jstream.write('"' + escapeDoubleQuotes(line.substr(1)) + '",\n\t');

    } else if (line == '') {
        if (state > 0)
            jstream.write('\t]\n\t}\n,');
        state = 0;
    }
}

/**
 * Parse smartcard_list.txt and turn it into a JSON structure
 */

var state = 0;

// https://gist.github.com/getify/3667624
function escapeDoubleQuotes(str) {
    return str.replace(/\\([\s\S])|(")/g, "\\$1$2");
}

jstream.write("if (typeof define !== 'function') {\nvar define = require('amdefine')(module);\n}\ndefine(function(require) {\n\nreturn [ ");

var rl = readline.createInterface(instream, outstream);
var rl2;

rl.on('line', parseLine);

rl.on('close', function() {
    rl2 = readline.createInterface(instream2, outstream);
    rl2.on('line', parseLine);
    rl2.on('close', function() {
        jstream.write(']\n});');
        jstream.end();
    });
});

