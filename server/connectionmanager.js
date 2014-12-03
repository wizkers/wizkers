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
    dbs = require('./pouch-config');


// Preload the parsers we know about:
var Fluke289 = require('./parsers/fluke289.js');
var Onyx = require('./parsers/safecast_onyx.js');
var FCOled = require('./parsers/fried_usb_tester.js');
var W433 = require('./parsers/w433.js');
var Elecraft = require('./parsers/elecraft.js');
var USBGeiger = require('./parsers/usb_geiger.js');

var ConnectionManager = function() {
 
    // This is an object that keeps keys that are instrumentids, and values that are driver objects
    var openinstruments = {};

    var getDriver = function(type) {
        var driver;
        if (type == "onyx") {
            driver = new Onyx();
        } else if ( type == "fcoledv1" ) {
            driver = new FCOled();
        } else if ( type == "fluke28x") {
            driver = new Fluke289();
        } else if ( type == "w433") {
            driver = new W433();
        } else if ( type == "elecraft") {
            driver = new Elecraft();
        } else if ( type == "usbgeiger") {
            driver = new USBGeiger();
        }
        return driver;
    }
    
    
    /**
     * Check if an instrument is open
     */
    this.isOpen = function(instrumentid) {
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
    this.openInstrument = function(instrumentid, callback) {
        console.log('[connectionmanager] Instrument open request for instrument ID ' + instrumentid);
        if (openinstruments.hasOwnProperty(instrumentid)) {
            console.log('That instrument is already open');
            // Return a pointer to the instrument's existing driver:
            return openinstruments[instrumentid];
        } else {
            // Create the relevant driver for the instrument, and ask to
            // open it:
            dbs.instruments.get(instrumentid, function(err,item) {
                var driver = getDriver(item.type);
                if (driver == undefined) {
                    // Something is very wrong here!
                    console.log("[connectionmanager] Was asked to open an instrument with unknown driver");
                    return;
                }
                driver.setInstrumentRef(instrumentid);
                openinstruments[instrumentid] = driver;
                // Now ask the instrument to open its port
                driver.openPort(item.port);
                console.log('[connectionmanager] Instrument is opening');
                callback(driver);
            });
        }
    }
    
    /**
     * Close an instrument.
     *
     * Question: shall it use a callback object called after successful instrument
     * closure ?
     */
    this.closeInstrument = function(instrumentid) {
        var driver = openinstruments[instrumentid];
        
        if (driver == undefined || driver == null) {
            // Still, we want to remove the key
            if (openinstruments.hasOwnProperty(instrumentid))
                delete openinstruments[instrumentid];
            return;
        }
        /*
                    dbs.instruments.get(data, function(err,item) {
                if(portOpen) {
                    recorder.stopRecording();
                    driver.stopLiveStream();
                    myPort.close();
                    portOpen = false;
                }
            });
        */
        
        driver.onClose();
        delete openinstruments[instrumentid];
        
    }
}

module.exports = ConnectionManager;