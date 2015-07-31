/** (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 *  The Connection manager
 *
 * - Opens and closes instruments
 * - Keeps tracks of what instrument is open or closed, so that
 *   the socket objects know what to do.
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 */

var Serial = require('./connections/serial'),
    dbs = require('./pouch-config'),
    outputmanager = require('./outputs/outputmanager'),
    recorder = require('./recorder'),
    debug = require('debug')('wizkers:connectionmanager');


// Preload the parsers we know about:
var Fluke289 = require('./parsers/fluke289.js');
var Onyx = require('./parsers/safecast_onyx.js');
var FCOled = require('./parsers/fried_usb_tester.js');
var W433 = require('./parsers/w433.js');
var Elecraft = require('./parsers/elecraft.js');
var USBGeiger = require('./parsers/usb_geiger.js');
var HeliumGeiger = require('./parsers/helium_geiger.js');
var HawkNest = require('./parsers/hawknest.js');
var SimpleSerial = require('./parsers/simple_serial.js');

var ConnectionManager = function () {

    // This is an object that keeps keys that are instrumentids, and values that are driver objects
    var openinstruments = {};

    var getDriver = function (type) {
        var driver;
        if (type == 'onyx') {
            driver = new Onyx();
        } else if (type == 'fcoledv1') {
            driver = new FCOled();
        } else if (type == 'fluke28x') {
            driver = new Fluke289();
        } else if (type == 'w433') {
            driver = new W433();
        } else if (type == 'elecraft') {
            driver = new Elecraft();
        } else if (type == 'usbgeiger') {
            driver = new USBGeiger();
        } else if (type == 'heliumgeiger') {
            driver = new HeliumGeiger();
        } else if (type == 'hawknest') {
            driver = new HawkNest();
        } else if (type == 'simple_serial') {
            driver = new SimpleSerial();
        }
        return driver;
    }

    /**
     * Go through all known instruments, and check if they should autoconnect.
     * Called at startup by the server.
     */
    this.autoConnect = function () {
        var self = this;
        // Find all instruments that want autoconnect:
        dbs.instruments.allDocs({
            include_docs: true
        }, function (err, items) {
            if (err) {
                debug('Error retrieving instruments - ' + err);
                return;
            }
            var resp = [];
            for (item in items.rows) {
                var doc = items.rows[item].doc;
                if (doc.autoconnect) {
                    self.openInstrument(doc._id, function (driver, id) {
                            self.autoRecord(id , driver);
                    });
                }
            }
        });

    }

    /**
     * Start to record. The instrument needs to be connected
     * @param {String} instrumentid The InstrumentID
     */
    this.autoRecord = function (instrumentid, driver) {
        dbs.instruments.get(instrumentid, function(err,item) {
            if (err) {
                debug('Autorecord error - ' + err);
                return;
            }
            if (!item.autorecord)
                return;
            // We need to create a new log which we will associate to the instrument
            var entry = {
                instrumentid: instrumentid,
                name: 'Autorecord',
                description: 'Autorecord',
                logtype: 'live'
            };
            debug('Starting autorecord for Instrument ID: ' + instrumentid + ' - ' + JSON.stringify(entry));
            dbs.logs.post(entry, function (err, result) {
                if (err) {
                    res.send({
                        'error': 'An error has occurred'
                    });
                } else {
                    debug('Success - result: ' + JSON.stringify(result));
                    recorder.startRecording(result.id, driver);
                }
            });
        });

    }

    /**
     * Check if an instrument is open
     */
    this.isOpen = function (instrumentid) {
        return openinstruments.hasOwnProperty(instrumentid);
    }

    /**
     * Open an instrument. Returns a driver object.
     *
     * If the instrument was already open, returns the reference to the
     * existing driver, otherwise create it.
     *
     *
     *
     * Note: connection manager does not handle authorization, the caller is
     * in charge of making sure it is authorized.
     */
    this.openInstrument = function (instrumentid, callback) {
        debug('Instrument open request for instrument ID ' + instrumentid);
        if (openinstruments.hasOwnProperty(instrumentid)) {
            debug('That instrument is already loaded');
            var driver = openinstruments[instrumentid];
            // Maybe the instrument is loaded but the port is closed: test
            // and act accordingly
            if (!driver.isOpen()) {
                driver.openPort(instrumentid);
            }
            // Return a pointer to the instrument's existing driver:
            callback(driver);
        } else {
            // Create the relevant driver for the instrument, and ask to
            // open it:
            dbs.instruments.get(instrumentid, function (err, item) {
                var driver = getDriver(item.type);
                if (driver == undefined) {
                    // Something is very wrong here!
                    debug('Was asked to open an instrument with unknown driver');
                    return;
                }
                openinstruments[instrumentid] = driver;
                // Now ask the instrument to open its port
                driver.openPort(instrumentid);
                debug('Instrument is opening');
                callback(driver, instrumentid);
            });
        }
    }

    /**
     * Close an instrument.
     *
     * Question: shall it use a callback object called after successful instrument
     * closure ?
     */
    this.closeInstrument = function (instrumentid) {
        var driver = openinstruments[instrumentid];

        if (driver == undefined || driver == null) {
            // Still, we want to remove the key
            if (openinstruments.hasOwnProperty(instrumentid))
                delete openinstruments[instrumentid];
            return;
        }
        // Ask the driver to close its port:
        driver.closePort();
        delete openinstruments[instrumentid];

    }
}

module.exports = ConnectionManager;