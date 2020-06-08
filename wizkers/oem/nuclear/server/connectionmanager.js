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

var dbs = require('./pouch-config'),
    outputmanager = require('./outputs/outputmanager'),
    recorder = require('./recorder'),
    debug = require('debug')('wizkers:connectionmanager');


// Preload the parsers we know about:
var Onyx = require('./parsers/safecast_onyx.js');
var USBGeiger = require('./www/js/app/instruments/usbgeiger/driver_backend.js');
var HawkNest = require('./parsers/hawknest.js');
var SimpleSerial = require('./parsers/simple_serial.js');
var Dummy = require('./parsers/dummy.js');
var RMYoung = require('./www/js/app/instruments/rmyoung/driver_backend.js');
var Kestrel5 = require('./www/js/app/instruments/kestrel5/driver_backend.js');
var BlueOnyx = require('./www/js/app/instruments/blue_onyx/driver_backend.js');
var InspectorBLE = require('./www/js/app/instruments/inspector_ble/driver_backend.js');
var BGeigie = require('./www/js/app/instruments/bgeigie/driver_backend.js');
var W433 = require('./parsers/w433.js');
var PiTemp =     require('./www/js/app/instruments/pitemp/driver_backend.js');
var EnvMonitor = require('./www/js/app/instruments/envmonitor/driver_backend.js');
var KestrelDrop = require('./www/js/app/instruments/kestreldrop/driver_backend.js');
var KestrelUSB = require('./www/js/app/instruments/kestrel5_usb/driver_backend.js');
var CairnXL = require('./www/js/app/instruments/cairnxl/driver_backend.js');
var Weatherflow = require('./www/js/app/instruments/weatherflow/driver_backend.js');

var ConnectionManager = function () {

    // This is an object that keeps keys that are instrumentids, and values that are driver objects
    var openinstruments = {};

    this.getDriver = function (type) {
        var driver;
        if (type == 'onyx') {
            driver = new Onyx();
        } else if (type == 'fcoledv1') {
            driver = new FCOled();
        } else if (type == 'fluke28x') {
            driver = new Fluke289();
        } else if (type == 'w433') {
            driver = new W433();
        } else if (type == 'usbgeiger') {
            driver = new USBGeiger();
        } else if (type == 'hawknest') {
            driver = new HawkNest();
        } else if (type == 'simple_serial') {
            driver = new SimpleSerial();
        } else if (type == 'powerlog_1') {
            driver = new Powerlog();
        } else if (type == 'rmyoung') {
            driver = new RMYoung();
        } else if (type == 'kestrel5') {
            driver = new Kestrel5();
        } else if (type == 'inspector_ble') {
            driver = new InspectorBLE();
        } else if (type == 'blue_onyx') {
            driver = new BlueOnyx();
        } else if (type == 'sample_instrument') {
            driver = new Dummy();
        } else if (type == 'bgeigie') {
            driver = new BGeigie();
        } else if (type == 'pitemp') {
            driver = new PiTemp();
        } else if (type == 'envmonitor') {
            driver = new EnvMonitor();
        } else if (type == 'kestreldrop') {
            driver = new KestrelDrop();
        } else if (type == 'kestrel5_usb') {
            driver = new KestrelUSB();
        } else if (type == 'cairnxl') {
            driver = new CairnXL();
        } else if (type == 'weatherflow') {
            driver = new Weatherflow();
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
                        self.autoRecord(id, driver);
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
        dbs.instruments.get(instrumentid, function (err, item) {
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
     * Note: connection manager does not handle authorization, the caller is
     * in charge of making sure it is authorized.
     */
    this.openInstrument = function (instrumentid, callback) {
        var self = this;
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
                var driver = self.getDriver(item.type);
                if (driver == undefined) {
                    // Something is very wrong here!
                    debug('Was asked to open an instrument with unknown driver:', item.type);
                    return;
                }
                openinstruments[instrumentid] = driver;
                // Now ask the instrument to open its port
                driver.openPort(instrumentid);
                debug('Instrument is opening');

                // Then also tell the output manager the instrument is open,
                // so that it reconnects its outputs. Again, no authorization handling,
                // we assume that the caller of openInstrument checked we had the right
                // to open - and thus to also reconnect the outputs.
                outputmanager.enableOutputs(instrumentid, driver);

                // Last, let our caller know the driver is ready:
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