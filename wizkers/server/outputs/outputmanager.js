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
 * The module that manages recording the output of an instrument to the
 * database
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

"use strict"

var dbs = require('../pouch-config'),
    _ = require("underscore")._,
    debug = require('debug')('wizkers:output');


var Safecast = require('./safecast.js');
var Rest = require('./rest.js');
var Text = require('./text.js');

/////////////////
// Private variales
/////////////////

var drivers = {};
var activeOutputs = {};
var availableOutputs = {
    "safecast": Safecast,
    "rest": Rest,
    "text": Text
};

////////////////
// Private methods
////////////////

// Returns 'true' if alarm is triggered
var check_alarm = function (output, alarm, data) {
    if (alarm.field != "_unused" && alarm.field != "") {
        var field = output.plugin.resolveMapping(alarm.field, data);
        if (field != undefined) {
            // If both field and alarm.level can be parsed as
            // numbers, do it:
            var numval = parseFloat(field);
            if (!isNaN(numval))
                field = numval;
            numval = parseFloat(alarm.level);
            if (!isNaN(numval))
                alarm.level = numval;

            switch (alarm.comparator) {
            case "less":
                return (field < alarm.level);
                break;
            case "moreeq":
                return (field >= alarm.level);
                break;
            case "eq":
                return (field == alarm.level);
                break;
            default:
                return false;
            }
        }
    }
    return false;
}

// Main feature of our manager: send the data
// to all active output plugins according to their
// schedule.
var output = function (data, insid) {
    if (!activeOutputs.hasOwnProperty(insid)) {
        debug("*** ERROR: asked to output data to output plugins that are not registered");
        return;
    }
    var active = activeOutputs[insid];
    for (var idx in active) {
        var output = active[idx];
        if (alarm(output,data) || regular(output)) {
            debug('Output triggered with this data', data);
            // We need to pass the index to the sendData call, so that it can be passed
            // back for the callback: this is because by the time the callback is called,
            // the object reference for 'output' will probably have changed, unless we only have
            // one output: so we cannot use 'output' in the callback even though it's still defined
            // in the closure. We therefore pass 'idx' and get it back as 'oidx'. numbers are not passed
            // by reference, so we're OK.
            output.plugin.sendData(data, idx, function (success, oidx) {
                debug('Output trigger success is ' + success + ' for output ' + oidx);
                if (success) {
                    active[oidx].last = new Date().getTime();
                }
            });
        }
    }
};


// Do we have an alarm on this output ?
var alarm = function (output, data) {
    var alarm1 = output.config.alarm1,
        alarm2 = output.config.alarm2,
        alrmbool = output.config.alrmbool,
        alarm = false;

    var alarm1_triggered = check_alarm(output, alarm1, data);
    var alarm2_triggered = check_alarm(output, alarm2, data);

    switch (alrmbool) {
    case 'and':
        alarm = (alarm1_triggered && alarm2_triggered);
        break;
    case 'or':
        alarm = (alarm1_triggered || alarm2_triggered);
        break;
    default:
        break;
    }

    if (!alarm)
        return false;

    var freq = output.config.alrmfrequency;
    if (freq == 0)
        return false; // zero is alarm disabled
    if ((new Date().getTime() - output.last) > freq * 1000)
        return true;
    return false;
};

var regular = function (output) {
    var freq = output.config.frequency;
    if (freq == 0)
        return false;
    if ((new Date().getTime() - output.last) > freq * 1000)
        return true;
    return false;
}



/**
 * Register a new instrument driver.
 */
var register = function (driver, cb) {
    var instrumentid = driver.getInstrumentId();
    if (drivers.hasOwnProperty(instrumentid)) {
        debug('We already knew this driver, we will unregister the previous callback');
        drivers[instrumentid].driver.removeListener('data', drivers[instrumentid].cb);
    }
    drivers[instrumentid] = {
        driver: driver,
        cb: cb
    };
}


////////////////
// Public API
////////////////


module.exports = {


    // Selects the active output plugins. Note that we only require
    // the instrument ID, since it stores its own list of enabled outputs,
    // and more importantly, all the settings for those.
    enableOutputs: function (insid, driver) {
        debug('Retrieving Outputs for Instrument ID: ' + insid);

        // Destroy the previous list of active outputs,
        activeOutputs[insid] = [];

        // TODO: use persistent queries before going to prod
        dbs.outputs.query(function (doc) {
                if (doc.enabled == true)
                    emit(doc.instrumentid);
            }, {
                key: insid,
                include_docs: true
            },
            function (err, outputs) {
                if (err && err.status == 404) {
                    debug("No enabled outputs");
                    return;
                }
                var gotOutputs = false;
                _.each(outputs.rows, function (out) {
                    // Now we need to configure the output and put it into our activeOutputs list
                    var pluginType = availableOutputs[out.doc.type];
                    if (pluginType == undefined) {
                        debug("***** WARNING ***** we were asked to enable an output plugin that is not supported but this server");
                    } else {
                        var plugin = new pluginType();
                        // The plugin needs its metadata and the mapping for the data,
                        // the output manager will take care of the alarms/regular output
                        plugin.setup(out.doc);
                        activeOutputs[insid].push({
                            "plugin": plugin,
                            "config": out.doc,
                            last: new Date().getTime()
                        });
                        gotOutputs = true;
                    }
                });
                if (gotOutputs) {
                    debug("Adding a callback for driver data");
                    // Now, register a callback on data events coming from the driver to
                    // trigger outputs:
                    var cb = function (data) {
                        output(data, insid);
                    };
                    register(driver, cb); // Keep track for later use when we stop recording
                    driver.on('data', cb);
                } else {
                    if (drivers.hasOwnProperty(insid)) {
                        debug('We don\'t have outputs, we will unregister any previous driver callback');
                        drivers[insid].driver.removeListener('data', drivers[insid].cb);
                    }
                }
            });
    },

    disconnectOutputs: function (insid) {
        if (!drivers.hasOwnProperty(insid)) {
            // We were asked to disconnect outputs that were not connected
            return;
        }
        var driver = drivers[insid].driver;
        driver.removeListener('data', drivers[insid].cb);
        delete drivers[insid];
        //
        // we don't really need to delete the list, because it gets
        // overwritten at connection
        /*
        if (! activeOutputs.hasOwnProperty(insid)) {
            // We were asked to disconnect outputs that were not connected
            // or there were just no outputs connected on that instrument.
            debug("WARNING: did not find outputs for that instrument but was still asked to disconnect them, FIXME");
            return;
        }
        */
    }

};