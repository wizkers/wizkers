/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
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
 * A Text output plugin: writes the latest values to a text file. Can work in
 * overwrite or append mode.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

var querystring = require('querystring'),
    utils = require('../utils.js'),
    dbs = require('../pouch-config'),
    fs = require('fs'),
    debug = require('debug')('wizkers:output:text');


module.exports = function text() {

    var mappings = null;
    var settings = null;
    var output_ref = null;
    var file_template = null;

    var matchTempl = function (str, args) {
        return str.replace(/<%=(.*?)%>/g, function (match, field) {
            // the != undefined test is necessary since args[field] can be == 0
            return (args[field] != undefined) ? args[field] : match;
        });
    }

    // Load the settings for this plugin
    this.setup = function (output) {

        debug("Setup a new instance");
        mappings = output.mappings;
        settings = output.metadata;
        output_ref = output;
        file_template = settings.texttemplate;

    };

    this.resolveMapping = function (key, data) {
        var m = mappings[key];
        if (typeof m == 'undefined')
            return undefined;
        // Static mappings start with "__"
        if (m.indexOf("__") == 0)
            return m.substr(2);
        return utils.JSONflatten(data)[mappings[key]];
    };

    this.sendData = function (data, idx, isAlarm, cb) {
        var self = this;
        var post_data = '';

        debug("Send data");

        // Step one: prepare the structure
        var fields = {};
        for (var mapping in mappings) {
            fields[mapping] = self.resolveMapping(mapping, data);
        };

        var contents = matchTempl(file_template, fields);
        debug('File contents', contents);
        output_ref.last = new Date().getTime();

        var fh = fs.openSync(settings.filename, (settings.writemode == 'append') ? 'a' : 'w');
        if (fh < 0) {
            output_ref.lastmessage = 'Error: could not open file';
            dbs.outputs.get(output_ref._id, function (err, result) {
                if (err) {
                    debug('Error saving error message in output status', err);
                    debug('Our output ref is', output_ref);
                }
                output_ref._rev = result._rev;
                dbs.outputs.put(output_ref, function (err, result) {});
            });
            cb(false, idx);
        }

        if (settings.writemode == 'append') {
            contents += '\n';
        }

        var bytes = fs.writeSync(fh, contents);
        if (bytes == 0) {
            output_ref.lastmessage = 'Error: file write error for ' + contents;
            dbs.outputs.get(output_ref._id, function (err, result) {
                if (err) {
                    debug('Error saving to DB after output error', err);
                    debug('Our output ref is', output_ref);
                    return;
                }
                output_ref._rev = result._rev;
                dbs.outputs.put(output_ref, function (err, result) {});
            });
            cb(false, idx);
        } else {
            output_ref.lastsuccess = new Date().getTime();
            output_ref.lastmessage = 'Success: wrote ' + contents;
            dbs.outputs.get(output_ref._id, function (err, result) {
                if (err) {
                    debug('Error saving to DB after output success', err);
                    debug('Our output ref is', output_ref);
                    return;
                }
                output_ref._rev = result._rev;
                dbs.outputs.put(output_ref, function (err, result) {});
            });
            cb(true, idx);
        }
    };
};