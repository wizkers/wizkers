const fs = require('fs');
const readline = require('readline');
const stream = require('stream');

var instream = fs.createReadStream('./smartcard_list.txt');
var outstream = new stream;
var rl = readline.createInterface(instream, outstream);

var jstream = fs.createWriteStream('./smartcard_list.js');

/**
 * Parse smartcard_list.txt and turn it into a JSON structure
 */

var state = 0;

// https://gist.github.com/getify/3667624
function escapeDoubleQuotes(str) {
    return str.replace(/\\([\s\S])|(")/g, "\\$1$2");
}

jstream.write("if (typeof define !== 'function') {\nvar define = require('amdefine')(module);\n}\ndefine(function(require) {\n\nreturn [ ");

rl.on('line', function(line) {

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


});

rl.on('close', function() {
    jstream.write(']\n});');
    jstream.end();
});