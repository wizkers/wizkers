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
 * Commands as per PC/SC v3 for storage cards
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

    var abutils = require('app/lib/abutils'),
        utils = require('app/utils');

    var storageCommands = function (driver) {

        /////////////
        // Private methods
        /////////////

        var self = this;

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
        return apdu;
    }

    var getATS = function() {
        var apdu = {
            cla: "FF",
            ins: "CA",
            p1: "01",
            p2: "00",
            lc: "00",
            data: "",
            le: ""
        };
        return apdu;
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
        var authErrors = {};
        authErrors["6300"] = "No information given";
        authErrors["6581"] = "Memory failure, addressed by P1-P2 does not exist";
        authErrors["6982"] = "Security status not satisfied";
        authErrors["6983"] = "Authentication cannot be done";
        authErrors["6984"] = "Reference key now useable";
        authErrors["6986"] = "Key type not known";
        authErrors["6988"] = "Key number not valid";
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
        return { apdu: apdu, errors: authErrors} ;
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
        var readErrors = {};
        readErrors["6281"] = "Part of returned data may be corrupted";
        readErrors["6282"] = "End of file reached before reading expected number of bytes";
        readErrors["6981"] = "Command incompatible";
        readErrors["6982"] = "Security status not satisfied";
        readErrors["6986"] = "Command not allowed";
        readErrors["6A81"] = "Function not supported";
        readErrors["6A82"] = "File not found / Addressed block or byte does not exist";
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

        return { apdu: apdu, errors: readErrors} ;
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
        var readErrors = {};
        readErrors["6281"] = "Part of returned data may be corrupted";
        readErrors["6282"] = "End of file reached before reading expected number of bytes";
        readErrors["6981"] = "Command incompatible";
        readErrors["6982"] = "Security status not satisfied";
        readErrors["6986"] = "Command not allowed";
        readErrors["6A81"] = "Function not supported";
        readErrors["6A82"] = "File not found / Addressed block or byte does not exist";
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

        return { apdu: apdu, errors: readErrors };
    };

    /* Reads a card page (Mifare Ultralight only)
    * A page is 4 bytes long, but some readers require larger minimum read sizes.
    * for this reason, we initialize "le" to "00" and just get the 4 first bytes.
    */
    var readPage = function(page) {
        var readErrors = {};
        readErrors["6281"] = "Part of returned data may be corrupted";
        readErrors["6282"] = "End of file reached before reading expected number of bytes";
        readErrors["6981"] = "Command incompatible";
        readErrors["6982"] = "Security status not satisfied";
        readErrors["6986"] = "Command not allowed";
        readErrors["6A81"] = "Function not supported";
        readErrors["6A82"] = "File not found / Addressed block or byte does not exist";
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
        return { apdu: apdu, errors: readErrors};
    };


    }

    // On server side, we use the Node eventing system, whereas on the
    // browser/app side, we use Bacbone's API:
    if (vizapp.type != 'server') {
        // Add event management, from the Backbone.Events class:
        _.extend(storageCommands.prototype, Backbone.Events);
    } else {
        storageCommands.prototype.__proto__ = events.EventEmitter.prototype;
        storageCommands.prototype.trigger = storageCommands.prototype.emit;
    }

    return storageCommands;
});