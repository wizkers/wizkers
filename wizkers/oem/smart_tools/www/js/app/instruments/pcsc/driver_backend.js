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

/*
 * Browser-side Parser for PCSC readers)
 *
 * Used for both browser side and server side.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

// This detects whether we are in a server situation and act accordingly:
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
    var vizapp = { type: 'server'},
    events = require('events'),
    abutils = require('app/lib/abutils'),
    dbs = require('pouch-config');
}

define(function (require) {
    "use strict";

    var utils = require('app/utils'),
        pcscConnection = require('connections/pcsc');

    var parser = function (socket) {

        /////////////
        // Private methods
        /////////////

        var socket = socket;

        var self = this,
            port = null,
            instrumentid = null,
            port_close_requested = false,
            port_open_requested = false,
            isopen = false;

        var portSettings = function () {
            return {};
        };

        var readers = [];
        var myReader = ''; // Currently selected reader


        // Format can act on incoming data from the PC/CS layer, and then
        // forwards the data to the app
        var format = function (data) {
            // Transform the data into a hex string (it's a buffer when it comes in)
            var datastr = abutils.ui8tohex(new Uint8Array(data))
            self.trigger('data', { data: datastr} );
        };

        // Status returns an object that is concatenated with the
        // global server status
        var status = function (stat) {
            port_open_requested = false;
            console.log('Port status change', stat);
            if (stat.openerror) {
                // We could not open the port: warn through
                // a 'data' messages
                var resp = {
                    openerror: true
                };
                if (stat.reason != undefined)
                    resp.reason = stat.reason;
                if (stat.description != undefined)
                    resp.description = stat.description;
                self.trigger('data', resp);
                return;
            }

            if (stat.portopen)
                isopen = stat.portopen;

            if (isopen)
                handleReaderStatus(stat);
            else {
                // We remove the listener so that the serial port can be GC'ed
                if (port_close_requested) {
                    if (port.off)
                        port.off('status', stat);
                    else
                        port.removeListener('status', status);
                    port_close_requested = false;
                }
            }
        };

        /**
         * Handle PC/SC specific status messages
         */
        var handleReaderStatus = function(stat) {
            console.log('PC/SC Status message');
            if (stat.device) {
                // PCSC device detected
                if (readers.indexOf(stat.device) == -1)
                    readers.push(stat.device);
            }
            self.trigger('data', stat);
        }

        var openPort_server = function(insid) {
            dbs.instruments.get(insid, function(err,item) {
                port = new pcscConnection(item.port, portSettings());
                port.on('data', format);
                port.on('status', status);
                port.open();
            });
        };

        var openPort_app = function(insid) {
            var ins = instrumentManager.getInstrument();
            // We now support serial over TCP/IP sockets: if we detect
            // that the port is "TCP/IP", then create the right type of
            // tcp port:
            var p = ins.get('port');
            if (p == 'TCP/IP') {
                // Note: we just use the parser info from portSettings()
                port = new tcpConnection(ins.get('tcpip'), portSettings().parser);
            } else if (p == 'Wizkers Netlink') {
                port = new tcpConnection(ins.get('netlink'), portSettings().parser);
                proto = new Protocol();
                proto.on('data', onProtoData);
            } else {
                port = new pcscConnection(ins.get('port'), portSettings());
            }
            port.on('data', format);
            port.on('status', status);
            port.open();
        }

        /* Loads a keypair into a reader memory slot
        This software uses slot 00 for key A
            and slot 1 for key B (this is arbitrary, it assumes
            that the reader has at least 2 slots for keys).

            FF 82 20 00 06 FF FF FF FF FF FF
                ||        ||
            Slot      Value
        *
        * Note: it seems some readers require volatile memory storage
        *       whether others require non-volatile...
        */
        var loadKey = function(key_a,key_b){

            // Be nice and output the full-text errors:
            var loadErrors = new Array();
            loadErrors[0x6300] = "No information given";
            // SCM Micro used v1.07 of the PC/SC 2 spec, which
            // forgot the SW1 value in the table, and incorrectly
            // assumed that SW1=63, whereas it should be 69 !
            loadErrors[0x6382] = "Card key not supported";
            loadErrors[0x6383] = "Reader key not supported";
            loadErrors[0x6384] = "Plain transmission not supported";
            loadErrors[0x6385] = "Secured transmission not supported";
            loadErrors[0x6386] = "Volatile memory is not available";
            loadErrors[0x6387] = "Non volatile memory is not available";
            loadErrors[0x6388] = "Key number not valid";
            loadErrors[0x6389] = "Key length is not correct";
            // Omnikey actually understands the principle:
            loadErrors[0x6982] = "Card key not supported";
            loadErrors[0x6983] = "Reader key not supported";
            loadErrors[0x6984] = "Plain transmission not supported";
            loadErrors[0x6985] = "Secured transmission not supported";
            loadErrors[0x6986] = "Volatile memory is not available";
            loadErrors[0x6987] = "Non volatile memory is not available";
            loadErrors[0x6988] = "Key number not valid";
            loadErrors[0x6989] = "Key length is not correct";

            /* If myReader is a Omnikey, then the key needs to be
            * loaded in non-volatile memory (code 0x20).
            * If it is a SCM, on the other hand, it needs to be
            * loaded in volatile memory (code 0x00).
            *
            * Moreover, SCM interprets P2 (key number) as the
            * key type (mifare A or B, 0x60 or 0x61) whereas Omnikey interprets
            * it as a key slot number... talk about standards-compliance!
            */
            var keyStructure = "20"; // non-volatile
            var keyNumber1 = "00";
            var keyNumber2 = "01";
            if ((myReader.indexOf("SCM") != -1)||(myReader.indexOf("SDI010") !=-1)) {
                keyStructure = "00";
                keyNumber1 = "60";
                keyNumber2 = "61";
            } else if (myReader.indexOf("Gemalto") != -1) {
                // GemProx uses 0x00 to 0x0F for Key A
                // and 0x10 to 0x1F for key B
                keyNumber2 = "10";
            }

            var apdu = {
                cla: "FF",
                ins: "82",
                p1: keyStructure,
                p2: keyNumber1,
                lc: "06",
                data: key_a,
                le: ""
            };
            var r = sc_transmit_apdu(apdu,myApduPanel);
            if (r === null) {
                debug("APDU transmit failed",myApduPanel);
                return false;
            }
            if(apdu.sw1 != "90") {
                debug("Error: " + loadErrors[parseInt(apdu.sw1+apdu.sw2,16)],myApduPanel);
                return false;
            }

            var apdu = {
                cla: "FF",
                ins: "82",
                p1: keyStructure,
                p2: keyNumber2,
                lc: "06",
                data: key_b,
                le: ""
            };
            var r = sc_transmit_apdu(apdu,myApduPanel);
            if (r === null) {
                debug("APDU transmit failed",myApduPanel);
                return false;
            }
            if(apdu.sw1 != "90") {
                debug("Error: " + loadErrors[parseInt(apdu.sw1+apdu.sw2,16)],myApduPanel);
                return false;
            }

            return true;	 
        }

        /* Gets the card's UID
    	 */
	    var getUID = function() {
            var apdu = {
                cla: "FF",
                ins: "CA",
                p1: "00",
                p2: "00",
                lc: "00",
                data: "",
                le: ""
            };
            var r = port.transmit_apdu(apdu,reader);
            if (r === null) {
                debug("APDU transmit failed");
                return "Error";
            }
            return apdu.resp;
    	}


        /* Authenticates in the card for a given block
        - sector: sector number
        - block : block number
        - key_type: "0" is key A, "1" is key B

        Returns 'true' if auth successful, 'false' otherwise

        APDU: 60 is Mifare key A
            61 is Mifare key B
            00 is Inside Contactless or iClass Kd
            01 is Inside Contactless or iClass Kc
            FF is Unknown or not necessary

        Example: Authenticate using key A and read 16 bytes:
            FF 88 00 00 60 00
            FF B0 00 00 10

        */
        var authenticateBlock = function(sector,block,key_type){
            // Be nice and output the full-text errors:
            var authErrors = new Array();
            authErrors[0x6300] = "No information given";
            authErrors[0x6581] = "Memory failure, addressed by P1-P2 does not exist";
            authErrors[0x6982] = "Security status not satisfied";
            authErrors[0x6983] = "Authentication cannot be done";
            authErrors[0x6984] = "Reference key now useable";
            authErrors[0x6986] = "Key type not known";
            authErrors[0x6988] = "Key number not valid";
            if (sector < 32) {
                var blockNum = sector * 4 + block;
            } else {
                // Mifare 4K
                var blockNum = 128 + (sector-32) * 16 + block;
            }
            (blockNum < 16) ? blockNum = "0" + blockNum.toString(16): blockNum = blockNum.toString(16);
            var keyType = 0x60 + parseInt(key_type);
            var key_number = "0" + key_type;
            if (myReader.indexOf("Gemalto") != -1) {
                // The GemProx implementation requires "00"
                // and the reader computes the key slot itself
                key_number = "00";
                var apdu = {
                    cla: "FF",
                    ins: "86",
                    p1: "00",
                    p2: "00",
                    lc: "05",
                    le: ""
                };
                apdu.data = "0100" + blockNum + keyType.toString(16) + key_number;
            } else {
                var apdu = {
                    cla: "FF",
                    ins: "88",
                    p1: "00",
                    p2: blockNum,
                    lc: keyType.toString(16),
                    data: key_number,
                    le: ""
                };
            }
            var r = sc_transmit_apdu(apdu,myApduPanel);
            if (r === null) {
                logD("APDU transmit failed",myApduPanel);
                return false;
            }
            if(apdu.sw1 == "90") {
                return true;
            }
            logD("Error: " + authErrors[parseInt(apdu.sw1+apdu.sw2,16)],myApduPanel);
            return false;
        };

        /* Read binary: reads a Mifare block (16 bytes)
        *
        * Needs to be authenticated before (see authenticateBlock)
        *
        * sector  : Sector number 
        * block   : Block number inside the sector
        *
        * 	FF B0 00 00 10
        */
        var readBinary = function(sector, block){
            var readErrors = new Array();
            readErrors[0x6281] = "Part of returned data may be corrupted";
            readErrors[0x6282] = "End of file reached before reading expected number of bytes";
            readErrors[0x6981] = "Command incompatible";
            readErrors[0x6982] = "Security status not satisfied";
            readErrors[0x6986] = "Command not allowed";
            readErrors[0x6A81] = "Function not supported";
            readErrors[0x6A82] = "File not found / Addressed block or byte does not exist";
            if (sector < 32) {
                var blockNum = sector * 4 + block;
            } else {
                // Mifare 4K
                var blockNum = 128 + (sector-32) * 16 + block;
            }
            (blockNum < 16) ? blockNum = "0" + blockNum.toString(16): blockNum = blockNum.toString(16);
            var apdu = {
                cla: "FF",
                ins: "B0",
                p1: "00",
                p2: blockNum,
                lc: "",
                data: "",
                le: "10"
            };

            var r = sc_transmit_apdu(apdu,myApduPanel);
            if (r === null) {
                logD("APDU transmit failed",myApduPanel);
                return "";
            }		
            if(apdu.sw1 != "90") {
                logD("Error: " + readErrors[parseInt(apdu.sw1+apdu.sw2,16)],myApduPanel);
                return "";
            }
            return apdu.resp;
        };

        /*
        * Writes a Mifare card block
        *
        * sector  : Sector number 
        * block   : Block number inside the sector
        * data    : hex string containing the data to be written
        *	     data shall be either 16 or 4 bytes long
        *
        * 	FF D6 ABLM ABLL 10 DATA
        *  Where: ABLM: address block MSB (0x00)
        *         ABLL: address block LSB (0x00 to 0xFF)
        *
        *  Requires a general authenticate before doing the operation.
        *
        * Note for UL cards: when using a GemProx-DU reader, only the first 4
        * bytes are written (one page), we follow the recommendations and set the
        * remaining bytes to zero
        */
        var updateBinary = function(sector, block, data){
            var readErrors = new Array();
            readErrors[0x6281] = "Part of returned data may be corrupted";
            readErrors[0x6282] = "End of file reached before reading expected number of bytes";
            readErrors[0x6981] = "Command incompatible";
            readErrors[0x6982] = "Security status not satisfied";
            readErrors[0x6986] = "Command not allowed";
            readErrors[0x6A81] = "Function not supported";
            readErrors[0x6A82] = "File not found / Addressed block or byte does not exist";
            if (sector < 32) {
                var blockNum = sector * 4 + block;
            } else {
                // Mifare 4K
                var blockNum = 128 + (sector-32) * 16 + block;
            }
            (blockNum < 16) ? blockNum = "0" + blockNum.toString(16): blockNum = blockNum.toString(16);
            switch (data.length) {
                case 32:
                    break;
                case 8:
                    data = data + "000000000000000000000000";
                    break;
                default:
                    logD("Error: data length incorrect, aborting", myApduPanel);
                    return false;
            }
            var apdu = {
                cla: "FF",
                ins: "D6",
                p1: "00",
                p2: blockNum,
                lc: "10",
                data: data,
                le: ""
            };

            var r = sc_transmit_apdu(apdu,myApduPanel);
            if (r === null) {
                logD("APDU transmit failed",myApduPanel);
                return false;
            }		
            if(apdu.sw1 != "90") {
                logD("Error: " + readErrors[parseInt(apdu.sw1+apdu.sw2,16)],myApduPanel);
                return false;
            }
            return true;
        };

        /* Reads a card page (Mifare Ultralight only)
        * A page is 4 bytes long, but some readers require larger minimum read sizes.
        * for this reason, we initialize "le" to "00" and just get the 4 first bytes.
        */
        var readPage = function(page) {
            var readErrors = new Array();
            readErrors[0x6281] = "Part of returned data may be corrupted";
            readErrors[0x6282] = "End of file reached before reading expected number of bytes";
            readErrors[0x6981] = "Command incompatible";
            readErrors[0x6982] = "Security status not satisfied";
            readErrors[0x6986] = "Command not allowed";
            readErrors[0x6A81] = "Function not supported";
            readErrors[0x6A82] = "File not found / Addressed block or byte does not exist";
            page = "0" + page.toString(16);
            var apdu = {
                cla: "FF",
                ins: "B0",
                p1: "00",
                p2: page,
                lc: "",
                data: "",
                le: "00"
            };
            var r = sc_transmit_apdu(apdu,myApduPanel);
            if (r === null) {
                logD("APDU transmit failed",myApduPanel);
                return "";
            }
            if(apdu.sw1 != "90") {
                logD("Error: " + readErrors[parseInt(apdu.sw1+apdu.sw2,16)],myApduPanel);
                return "";
            }
            return apdu.resp.substr(0,8);
        };



        /////////////
        // Public methods
        /////////////

        this.openPort = function (insid) {
            port_open_requested = true;
            instrumentid = insid;
            if (vizapp.type == 'server') {
                openPort_server(insid);
            } else {
                openPort_app(insid);
            }
        };

        this.closePort = function (data) {
            // We need to remove all listeners otherwise the serial port
            // will never be GC'ed
            if (port.off)
                port.off('data', format);
            else
                port.removeListener('data', format);
            port_close_requested = true;
            port.close();
        }

        this.isOpen = function () {
            return isopen;
        }

        this.isOpenPending = function () {
            return port_open_requested;
        }

        this.getInstrumentId = function (arg) {
            return instrumentid;
        };

        // Called when the app needs a unique identifier.
        // this is a standardized call across all drivers.
        //
        this.sendUniqueID = function () {
            // We cheat a bit here this is used to send
            // the list of existing readers
             for (var i =0; i < readers.length; i++) {
                self.trigger('data', { device: readers[i], action: 'added'});
            }
        };

        this.isStreaming = function () {
            return true;
        };

        // period in seconds
        this.startLiveStream = function (period) {
        };

        this.stopLiveStream = function (args) {};

        // output should return a string, and is used to format
        // the data that is sent on the serial port, coming from the
        // HTML interface.
        this.output = function (data) {
            if (data == "TAG") {
                self.trigger('data', {
                    devicetag: 'Not supported'
                });
            }
            // Do a bit of reformatting on some commands
            if (data.cmd == 'transmit') {
                var apdu_ab = abutils.hextoab(data.arg.apdu);
                var apdu_arr = [].slice.call(new Uint8Array(apdu_ab)); // Make it an array of bytes
                data.arg.apdu = apdu_arr;        
            }
            port.write(data);
        };

    }

    // On server side, we use the Node eventing system, whereas on the
    // browser/app side, we use Bacbone's API:
    if (vizapp.type != 'server') {
        // Add event management to our parser, from the Backbone.Events class:
        _.extend(parser.prototype, Backbone.Events);
    } else {
        parser.prototype.__proto__ = events.EventEmitter.prototype;
        parser.prototype.trigger = parser.prototype.emit;
    }

    return parser;
});