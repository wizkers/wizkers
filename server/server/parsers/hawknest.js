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

/*
 * A parser for the Medcom Hawk Nest Pinocc.io-based modules
 *
 * @author Edouard Lafargue, ed@lafargue.name
 *
 */

"use strict";

var events = require('events'),
    pinoconnection = require('../connections/pinoccio-server'),
    dbs = require('../pouch-config'),
    debug = require('debug')('wizkers:parsers:hawknest');

var HawkNest = function () {

    // Debug function for revision control (check that we don't
    // keep infinite revisions in the database, thus exploding our
    // storage capacity.
    function printRevisions(result) {
        return dbs.instruments.get(result._id, {
            revs: true
        }).then(function (doc) {
            debug('**********************************************');
            // convert revision IDs into full _rev hashes
            var start = doc._revisions.start;
            return PouchDB.utils.Promise.all(doc._revisions.ids.map(function (id, i) {
                var rev = (start - i) + '-' + id;
                return dbs.instruments.get(id, {
                    rev: rev
                }).then(function (doc) {
                    return [rev, doc];
                }).catch(function (err) {
                    if (err.status !== 404) {
                        throw err;
                    }
                    return [rev, err];
                });
            })).then(function (revsAndDocs) {
                revsAndDocs.forEach(function (revAndDoc) {
                    debug('Fetched revision "' + revAndDoc[0] + '": ' + JSON.stringify(revAndDoc[1]));
                });
            });
        });
    }


    // Driver initialization
    events.EventEmitter.call(this);

    /////////
    // Private variables
    /////////
    var port = null;
    var isopen = false;
    var port_close_requested = false;
    var self = this;
    var instrument;
    var instrumentid;

    // Keep track of last call time for throttling commands
    // to the probes (don't send too many)
    var last_cmd_time = {};

    // Keep track of the probes we know about, by token
    var probes = {};

    /////////
    // Private methods
    /////////

    var status = function (stat) {
        debug('Network status change', stat);
        isopen = stat.portopen;

        if (isopen) {
            // Should run any "onOpen" initialization routine here if
            // necessary.
        } else {
            // We remove the listener so that the serial port can be GC'ed
            if (port_close_requested) {
                port.removeListener('status', status);
                port_close_requested = false;
            }
        }
    };

    /**
     * format receives incoming data, and formats it before sending to the
     * front-end. Usually, the recorder, outputmanager and the server will
     * listen for 'data' events emitted by 'format'
     * Format is called as a callback by the serial port, so 'this' is
     * the serial object, not this driver!
     * @param {Object} data the data
     */
    var format = function (data) {
        var jsresp;
        debug(data);

        if (data.token == undefined)
            return;

        if (probes[data.token] == undefined)
            probes[data.token] = {
                probeid: -1
            };

        // Now extract what we really are interested into:
        if (data.report) {
            var val = data.report;
            if (val.type == 'Hawk') {
                jsresp = {
                    cpm: {
                        value: val.ch1,
                        valid: true
                    },
                    cpm2: {
                        value: val.ch2,
                        valid: true
                    },
                    probeid: val.hwser,
                    timestamp: val.at
                };

                // Map the hwser to the token, since the front-end uses the (unique) hwser
                // to track the probes
                probes[data.token].probeid = val.hwser;

                // Memorize the Probe ID in the Pinoccio instrument, so that we can
                // name the probes on the front-end
                var known_probes = instrument.metadata.probes || {};
                if (known_probes[val.hwser] == undefined) {
                    debug('Adding new discovered probe:' + val.hwser);
                    dbs.instruments.get(instrument._id, function (err, result) {
                        if (err) {
                            debug("Error updating probe name: " + err);
                            return;
                        }
                        if (result.metadata.probes == undefined)
                            result.metadata.probes = {};
                        result.metadata.probes[val.hwser] = {
                            name: '' + val.hwser
                        };
                        debug('New instrument state', result);
                        instrument = result; // Otherwise we'll keep on adding the probes!
                        dbs.instruments.put(result, function (err, result) {
                            if (err) {
                                debug(err);
                                return;
                            }
                        });
                    });
                }

                // Extract a proper date from the data:
                var date = val.year + 2000 + '/' + val.month + '/' + val.day;
                var time = val.hour + ':' + val.min + ':' + val.sec + ' UTC';
                jsresp.devicestamp = Date.parse(date + ' ' + time); // Javascript timestamp (microseconds since Jan 1 1970 UTC)

                var ts = new Date().getTime();
                if (last_cmd_time[data.token] == undefined)
                    last_cmd_time[data.token] = ts;

                if (ts - last_cmd_time[data.token] > 5000) {
                    last_cmd_time[data.token] = ts;
                    // Whenever we get data, attempt to resync the unit time to avoid any drift
                    var d = new Date();
                    // Warning: this code will break after 2100:
                    var cmd = 'nest.settimedate(\\"' + (d.getUTCFullYear() - 2000) +
                        ((d.getUTCMonth() < 9) ? '0' : '') + (d.getUTCMonth() + 1) +
                        ((d.getUTCDate() < 10) ? '0' : '') + d.getUTCDate() +
                        ((d.getUTCHours() < 10) ? '0' : '') + d.getUTCHours() +
                        ((d.getUTCMinutes() < 10) ? '0' : '') + d.getUTCMinutes() +
                        ((d.getUTCSeconds() < 10) ? '0' : '') + d.getUTCSeconds() +
                        '\\")';
                    debug(cmd);
                    self.output({
                        token: data.token,
                        command: cmd
                    });

                    // Then ask for power as well, while we can
                    cmd = 'power.report';
                    self.output({
                        token: data.token,
                        command: cmd
                    });
                }

            } else if (val.type == 'power' || val.type == 'temp' || val.type == 'solar') {
                // We need to add the probeID otherwise the front-end won't be able
                // to tell what probe this reading is for!
                val.probeid = probes[data.token].probeid;
                jsresp = val;

                // Store the results into the instrument info, so that it can be
                // monitored by the front-end
                var known_probes = instrument.metadata.probes || {};
                if (known_probes[val.probeid] != undefined) {
                    dbs.instruments.get(instrument._id).then(function (result) {
                            result.metadata.probes[val.probeid].ts = new Date().getTime();
                            if (val.voltage != undefined)
                                result.metadata.probes[val.probeid].voltage = val.voltage;
                            if (val.type == 'power' && val.battery != undefined)
                                result.metadata.probes[val.probeid].battery = val.battery;
                            if (val.type == 'solar' && val.battery != undefined)
                                result.metadata.probes[val.probeid].solarbattvoltage = val.battery;
                            if (val.charging != undefined)
                                result.metadata.probes[val.probeid].charging = val.charging;
                            if (val.type == 'temp' && val.c != undefined)
                                result.metadata.probes[val.probeid].temp = val.c;
                            instrument = result; // Otherwise we'll keep on adding the probes!
                            debug(result.metadata.probes[val.probeid]);
                            return dbs.instruments.put(result);
                        }).catch(function (err) {
                            debug("Error updating probe name: " + err);
                            return;
                        });
                }
            }
        }
        if (jsresp !== undefined)
            self.emit('data', jsresp);
    };

    /////////
    // Public variables
    /////////
    this.name = "hawknest";

    /////////
    // Public API
    /////////

    // Creates and opens the connection to the instrument.
    // for all practical purposes, this is really the init method of the
    // driver
    this.openPort = function (id) {
        instrumentid = id;
        dbs.instruments.get(id, function (err, item) {
            instrument = item; // We will use this later
            debug(instrument);
            port = new pinoconnection(instrument.pinoccio);
            port.on('data', format);
            port.on('status', status);
            port.open();
        });
    }

    this.closePort = function (data) {
        if (!isopen)
            return;
        // We need to remove all listeners otherwise the serial port
        // will never be GC'ed
        port.removeListener('data', format);
        port_close_requested = true;
        port.close();
    }

    this.isOpen = function () {
        return isopen;
    }

    this.getInstrumentId = function (format) {
        return instrumentid;
    };


    // Called when the HTML app needs a unique identifier.
    // this is a standardized call across all drivers.
    this.sendUniqueID = function () {
        this.emit('data', {
            uniqueID: '00000000 (n.a.)'
        });
    };

    this.isStreaming = function () {
        return true;
    };

    // This dongle always outputs CPM value on the serial port
    this.startLiveStream = function (period) {};

    // Even though we ask to stop streaming, the dongle will still
    // stream.
    this.stopLiveStream = function (period) {};


    /**
     * Sends a command to the Pinocc.io board.
     * @param   {Object} data Object containing at least a 'id' and a 'command' field,
     *                      which are the ID of the board to send the command to, and the
     *                      'command' to send to the board (in scoutscript syntax).
     */
    this.output = function (data) {
        debug("Command sent to Pinoccio", data);
        if (data == "TAG") {
            this.emit('data', {
                devicetag: 'Not supported'
            });
            return;
        }
        port.write(data);
    }

};

HawkNest.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = HawkNest;