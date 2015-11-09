/** (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
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

    this.sendData = function (data, cb) {
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
                output_ref._rev = result._rev;
                dbs.outputs.put(output_ref, function (err, result) {});
            });
            cb(false);
        }

        if (settings.writemode == 'append') {
            contents += '\n';
        }

        var bytes = fs.writeSync(fh, contents);
        if (bytes == 0) {
            output_ref.lastmessage = 'Error: file write error for ' + contents;
            dbs.outputs.get(output_ref._id, function (err, result) {
                output_ref._rev = result._rev;
                dbs.outputs.put(output_ref, function (err, result) {});
            });
            cb(false);
        } else {
            output_ref.lastsuccess = new Date().getTime();
            output_ref.lastmessage = 'Success: wrote ' + contents;
            dbs.outputs.get(output_ref._id, function (err, result) {
                output_ref._rev = result._rev;
                dbs.outputs.put(output_ref, function (err, result) {});
            });
            cb(true);
        }
    };
};