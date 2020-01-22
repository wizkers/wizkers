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
 * Driver for PCSC readers
 *
 * Used for both browser side and server side. Note: only implemented
 * and tested server-side so far.
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
    crypto = require('crypto');
}

define(function (require) {
    "use strict";

    var utils = require('app/utils'),
        CryptoJS = require('crypto-js'),
        storageCommands = require('app/instruments/pcsc/commands_storage'),
        desfireCommands = require('app/instruments/pcsc/commands_desfire'),
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

        // Command processing
        var commandQueue = [],
        queue_busy = false,
        wd = null;

        // Variables related to authentication.
        // We can only be authenticated with one key at at time
        var AUTH = { IDLE:0, CHAL:1, RESP: 2, EST: 3};
        var CIPHER = { ToPICC: 0, FromPICC: 1, Encrypt: 2, Decrypt: 3};
        var auth_keynum =0,
            auth_keyval = '',
            auth_RndA = '',
            auth_RndB =  '',
            auth_ivect = '',
            auth_keysession = '',
            auth_state = AUTH.IDLE;

        // Great big table of return codes
        // Check https://www.eftlab.co.uk/index.php/site-map/knowledge-base/118-apdu-response-list
        // for a longer list, below is 7816-4 and PC/SC mostly
        const codes_sw1 = {
            "61": { 
                'sw1': "SW2 indicates the number of response bytes still available (see text below)",
                'sw2': {}
            },
            "62": {
                "sw1": "State of non-volatile memory unchanged",
                "sw2": {
                    "00": "No information given",
                    "81": "Part of returned data may be corrupted",
                    "82": "End of file/record reached before reading Le bytes",
                    "83": "Selected file invalidated",
                    "84": "FCI not formatted according to ISO7816-4"
                }     
            },
            "63": { 
                "sw1": "State of non-volatile memory changed",
                "sw2": {
                    "00": "No information given",
                    "81": "File filled up by the last byte",
                    "82": "Card key not supported (PC/SC)",
                    "83": "Reader key not supported (PC/SC)",
                    "84": "Plain transmission not supported (PC/SC)",
                    "85": "Secured transmission not supported (PC/SC)",
                    "86": "Volatile memory is not available (PC/SC)",
                    "87": "Non volatile memory is not available (PC/SC)",
                    "88": "Key number not valid (PC/SC)",
                    "89": "Key length is not correct (PC/SC)",
                    "C0": "Verify fail, no try left",
                    "C1": "Verify fail, 1 try left",
                    "C2": "Verify fail, 2 tries left",
                    "C3": "Verify fail, 3 tries left",
                  // CX	The counter has reached the value 'x' (0 = x = 15)
                    "F1": "More data expected",
                    "F2": "More data expected and proactive command pending"        
                }
            },
            "64": {
                "sw1": "State of non-volatile memory unchanged",
                "sw2": {
                    "00": "State of non-volatile memory unchanged"
                }
            },
            "65": {
                "sw1": "State of non-volatile memory changed",
                "sw2": {
                    "00": "No information given",
                    "81": "Memory failure"        
                }
            },
            "66": {
                "sw1":  "Reserved for security-related issues",
                "sw2": {
                    "00": "Error while receiving (timeout)",
                    "01": "Error while receiving (character parity error)",
                    "02": "Wrong checksum",
                    "03": "The current DF file without FCI",
                    "04": "No SF or KF under the current DF",
                    "69": "Incorrect Encryption/Decryption Padding"
                }
            },
            "67": {
                "sw1": "Wrong length",
                "sw2": {
                }
            },
            "68": {
                "sw1": "Functions in CLA not supported",
                "sw2": {
                    "00": "No information given",
                    "81": "Logical channel not supported",
                    "82": "Secure messaging not supported",
                    "83": "Last command of the chain expected",
                    "84": "Command chaining not supported",
                }
            },
            "69": {
                "sw1": "Command not allowed",
                "sw2": {
                    "00": "No information given",
                    "01": "Command not accepted (inactive state)",
                    "81": "Command incompatible with file structure",
                    "82": "Security status not satisfied / Card key not supported (PC/SC)",
                    "83": "Authentication method blocked / Reader key not supported (PC/SC)",
                    "84": "Referenced data invalidated / Plain transmission not supported (PC/SC) / Reference key or data not useable",
                    "85": "Conditions of use not satisfied / Secured transmission not supported (PC/SC)",
                    "86": "Command not allowed (no current EF) / Volatile memory is not available  / Key type not known (PC/SC)",
                    "87": "Expected SM data objects missing / Non volatile memory is not available (PC/SC)",
                    "88": "SM data objects incorrect / Key number not valid (PC/SC)",
                    "89": "Key length is not correct (PC/SC)",
                    "96": "Data must be updated again",
                    "E1": "POL1 of the currently Enabled Profile prevents this action.",
                    "F0": "Permission Denied",
                    "F1": "Permission Denied - Missing Privilege"
                }
            },
            "6A": {
                "sw1":  "Wrong parameter(s) P1-P2",
                "sw2": {
                    "00": "No information given",
                    "80": "Incorrect parameters in the data field",
                    "81": "Function not supported",
                    "82": "File not found /  Addressed block or byte does not exist (PC/SC)",
                    "83": "Record not found",
                    "84": "Not enough memory space in the file",
                    "85": "Lc inconsistent with TLV structure",
                    "86": "Incorrect parameters P1-P2",
                    "87": "Lc inconsistent with P1-P2",
                    "88": "Referenced data not found",
                    "89": "File already exists",
                    "8A": "DF name already exists",
                    "F0": "Wrong parameter value",
                }
            },
            "6B": {
                "sw1": "Wrong parameter(s) P1-P2",
                "sw2": {

                }
            },
            "6C": {
                "sw1":  "Wrong length Le: SW2 indicates the correct length",
                "sw2": {
                    "00": "Incorrect P3 length"

                }
            },
            "6D": {
                "sw1": "Instruction code not supported or invalid",
                "sw2": {

                }
            },
            "6E": {
                "sw1": "Class not supported",
                "sw2": {
                    "00": "Invalid class"
                }
            },
            "6F": {
                "sw1": "No precise diagnostic",
                "sw2": {
                }
            },
            "90": {
                "sw1": "No further qualification",
                "sw2": {
                    "00": "Command successful",
                    "04": "PIN not successfully verified, 3 or more PIN tries left",
                    "08": "Key/file not found",
                    "80": "Unblock tru counter has reached zero"
                }
            },
            "91": { // Valid for Desfire ops (wrapped APDUs), maybe others
                "sw1": "DESfire",
                "sw2": {
                    "00": "Command successful",
                    "0C": "No changes done to backup file",
                    "0E": "Out of EEPROM Error, insufficient memory to complete command",
                    "1C": "ILLEGAL_COMMAND_CODE - command code not supported",
                    "1E": "INTEGRITY_ERROR - CRC or MAC does not match data, or padding bytes not valid",
                    "40": "NO_SUCH_KEY - Invalid key number specified",
                    "7E": "LENGTH_ERROR - Length of command string invalid",
                    "9D": "PERMISSION_DENIED - Current configuration / status does not allow the requested command",
                    "9E": "PARAMETER_ERROR - Value of the parameter(s) invalid",
                    "A0": "APPLICATION_NOT_FOUND - requested AID not present on PICC",
                    "A1": "APPL_INTEGRITY_ERROR - Unrecoverale error within application, app will be disabled (card is probably damaged)",
                    "AE": "AUTHENTICATION_ERROR - Current authentication status does not allow the requested command",
                    "AF": "ADDITIONAL_FRAME - Additional data frame is expected to be sent",
                    "BE": "BOUNDARY_ERROR - Attempt to read/write data from/to beyond the file limits",
                    "C1": "PICC_INTEGRITY_ERRPR - Unrecoverable error within PICC, PICC will be disabled (good bye)",
                    "CA": "COMMAND_ABORTED - Previous commanbd was not fully completed",
                    "CD": "PICC_DISABLED - PICC was disabled by an unrecoverable error",
                    "CE": "COUNT_ERROR - Number of applications limited to 28, no additional CreateApplication possible",
                    "DE": "DUPLICATE_ERROR - Creation of file/applications failed because file/application witht same number already exists",
                    "EE": "EEPROM_ERROR - Could not complete NV-write operation due to loss of power, internal backup/rollback mechanism activated",
                    "F0": "FILE_NOT_FOUND - Specified file number does not exist",
                    "F1": "FILE_INTEGRITY_ERROR - Unrecoverable error within file, file will be disabled"
                }
            }
        };
        
        var buildStatusDesc = function(sw1, sw2) {
            let r = '';
            sw1 = ("00" + sw1.toString(16)).slice(-2).toUpperCase();
            sw2 = ("00" + sw2.toString(16)).slice(-2).toUpperCase();
            if (codes_sw1[sw1] != undefined) {
                r += codes_sw1[sw1].sw1 + ' / ';
                if (codes_sw1[sw1].sw2[sw2] != undefined) {
                    r += codes_sw1[sw1].sw2[sw2];
                }
            } else {
                r += 'Status code unknown'; 
            }
            return r;
        }

        // data has to be a hex string
        // Relies on good state of auth_ivect and auth_keyval
        var encipher_data_aes = function(data) {
            var enc = CryptoJS.AES.encrypt(CryptoJS.enc.Hex.parse(data),auth_keyval,{ mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.NoPadding, iv: CryptoJS.enc.Hex.parse(auth_ivect) }).ciphertext.toString();
            auth_ivect = enc.slice(-32); // Last block of 16 bytes
            return enc;
        }

        // XOR two hex strings. Slow.
        var xor = function(str1, str2) {
            var c = '';
            for(var i = 0; i < str1.length; i+=2) {
                var s1 = parseInt(str1.substring(i,i+2),16);
                var s2 = parseInt(str2.substring(i,i+2),16);
                c += ("00" + (s1 ^ s2).toString(16)).slice(-2);
            }
            return c;
        }

        // Needs auth_ivect to be initialized, as well as auth_keyval
        // 
        var decipher_data_aes = function(data) {
            var block_size = auth_keyval.toString().length;
            debug('Block size', block_size);
            var r = new RegExp(".{1,"+block_size+"}","g")
            var blocks = data.match(r);
            var res = '';
            for (var i in blocks) {
                var d = blocks[i];
                var ovect = d;
                var ct = CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Hex.parse(d)});
                // Note: ZeroPadding might not work 100% with Desfire spec, to be verified
                var dec = CryptoJS.AES.decrypt(ct,auth_keyval,{ mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.ZeroPadding}).toString();
                res += xor(dec, auth_ivect);
                auth_ivect = ovect;
            }
            return res;
        }


        // Format can act on incoming data from the PC/CS layer, and then
        // forwards the data to the app
        var format = function (data) {
            clearTimeout(wd);
            var cmd = commandQueue.shift();
            console.info('Done with command', cmd);

            // Transform the data into a hex string (it's a buffer when it comes in)
            var datastr = abutils.ui8tohex(new Uint8Array(data.resp));
            if (datastr.length < 4) {
                self.trigger('data', { data: datastr, 
                sw1sw2: 'Error, short response, cannot process',
               command: cmd } );
            } else {
                // Add comments on last 2 bytes status code
                let sw1 = data.resp[data.resp.length-2];
                let sw2 = data.resp[data.resp.length-1];
                let sw1sw2 = buildStatusDesc(sw1, sw2);
                self.trigger('data', { data: datastr, 
                                    sw1sw2: sw1sw2,
                                    command: cmd } );
            }
            queue_busy = false;

            // Some commands require processing on the driver side, in particular this is
            // where we implement all the crypto. This is debatable, since this means that
            // we end up sending decrypted plaintext data between the server and the browser
            // but this would best be addresses with encrypted communications between the
            // server and the browser, rather than do DES or AES in the browser. to be
            // continued...
            if (cmd.command == 'desfire_AESAuthenticate') {
                cmd.key = auth_keynum; // Needed by frontend to understand what's going on
                debug('Reply to AESAuthenticate');
                if (datastr.slice(-4) != "91af") {
                    delete cmd.r;
                    delete cmd.apdu; // The front-end already received it...
                    debug("Error, did not receive expected response");
                    self.trigger('data', { data: '', 
                    sw1sw2: 'Authentication fail',
                    command: cmd } );
                } else {
                    auth_ivect = "00000000000000000000000000000000";
                    // var challenge = CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Hex.parse(datastr.substring(0, datastr.length - 4))});
                    // debug('Encrypted challenge', challenge.ciphertext.toString());
                    // // Step 1: decipher the challenge w/ the auth key (decChallenge is a hex string)
                    // var decChallenge = CryptoJS.AES.decrypt(challenge,auth_keyval,{ mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.NoPadding, iv: CryptoJS.enc.Hex.parse(auth_ivect) }).toString();
                    // auth_ivect = CryptoJS.enc.Hex.parse(challenge.ciphertext.toString());
                    // debug('Decrypted challenge', decChallenge);
                    var challenge = datastr.substring(0, datastr.length - 4);
                    debug('Encrypted challenge', challenge);
                    // Step 1: decipher the challenge w/ the auth key (decChallenge is a hex string)
                    var decChallenge = decipher_data_aes(challenge);
                    debug('Decrypted challenge', decChallenge);
                    auth_RndB = decChallenge;
                    var rotChallenge = decChallenge.substring(2,decChallenge.length) + decChallenge.substring(0,2);
                    debug('Rotated   challenge', rotChallenge);
                    // Step 2: add our own random challenge 
                    var ourChallenge = crypto.randomBytes(16).toString('hex'); // NOTE: on browser-side, woudl have to use 'crypto.getRandomValue(new Uint8Array(16))
                    auth_RndA = ourChallenge;
                    var response = ourChallenge + rotChallenge;
                    debug('RndA + RndB\'       ', response);
                    // Step 3: encipher the response
                    var encResponse = encipher_data_aes(response);
                    // var encResponse = CryptoJS.AES.encrypt(CryptoJS.enc.Hex.parse(response),auth_keyval,{ mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.NoPadding, iv: CryptoJS.enc.Hex.parse(challenge.ciphertext.toString()) }).ciphertext.toString();
                    debug('Response           ', encResponse);
                    // // TODO: save our iVect: it _should_ be the last encrypted block (last 16 bytes) of response
                    // auth_ivect = encResponse.substring(32);
                    self.output({
                        reader: cmd.reader,
                        command: 'desfire_AESAuthenticate_Response',
                        r: encResponse
                    });
                }
            } else if (cmd.command == 'desfire_AESAuthenticate_Response') {
                cmd.key = auth_keynum; // Needed by frontend to understand what's going on
                debug("Last phase of AES Authenticate");
                if (datastr.slice(-4) != "9100") {
                    delete cmd.r;
                    delete cmd.apdu; // The front-end already received it...
                    debug("Error, did not receive expected response");
                    self.trigger('data', { data: '', 
                    sw1sw2: 'Authentication fail',
                    command: cmd } );
                } else {
                    var response = datastr.substring(0, datastr.length - 4);
                    debug('Encrypted response', response);
                    // Step 1: decrypt the response
                    var decResponse = decipher_data_aes(response);
                    decResponse = decResponse.slice(-2) + decResponse.slice(0,-2); // Rotate the response back
                    debug('Decrypted response', decResponse);
                    debug('ivect             ', auth_ivect);
                    debug('Our RndA          ', auth_RndA);
                    // Step 2: check that the decrypted response matches our RndA
                    delete cmd.r;
                    delete cmd.apdu;
                    if (decResponse == auth_RndA) {
                        self.trigger('data', { data: '', 
                            sw1sw2: 'Authentication success',
                            command: cmd } );
                        // Last: save our session key
                        // AES session key := RndA byte 0..3 + RndB byte 0..3 + RndA byte 12..15 + RndB byte 12..15
                        auth_keysession = auth_RndA.substring(0,8) + auth_RndB.substring(0,8) + auth_RndA.substring(24) + auth_RndB.substring(24);
                        debug('Session key', auth_keysession, 'length:', auth_keysession.length);
                    } else {
                        self.trigger('data', { data: '', 
                            sw1sw2: 'Authentication fail',
                            command: cmd } );
                    }
                }
            }

            // If we have commands left in the queue, now is the time to process them
            if (commandQueue.length) {
                processQueue();
            }

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

            if (stat.error) {
                // Received a low level error during normal operation,
                // tell the front-end through a 'data' message
                var resp = {
                    error: stat.error.message
                };
                self.trigger('data', resp);
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
            debug('PC/SC Status message', stat);
            if (stat.device) {
                // PCSC device detected
                if (readers.indexOf(stat.device) == -1)
                    readers.push(stat.device);
            }
            if (stat.error)
                return; // PC/SC errors are already handled in the 'status' handler
            self.trigger('data', stat);
        }

        /**
         * Format a json APDU into a hex string
         */
        var apdu2str = function(apdu) {
            try {
                return apdu.cla + apdu.ins + apdu.p1 + apdu.p2 +
                        apdu.lc + apdu.data + apdu.le;
            } catch (e) {
                return '';
            }
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

        // Process the latest command in the queue.
        //
        // Queue contains Objects with:
        //  - command: the command name
        //  - arg    : (optional) the command argument as a hex string
        var processQueue = function() {
            if (commandQueue.length == 0)
                return;
            var cmd = commandQueue[0]; // Get the oldest command

            if (queue_busy)
                return;
            queue_busy = true;

            var data = {};
            data.reader = cmd.reader;

            switch(cmd.command) {
                case 'pcsc_getUID':
                    data.command = 'transmit';
                    var t = storageCommands.getUID();
                    data.apdu = apdu2str(t);
                    break;
                case 'pcsc_getATS':
                    data.command = 'transmit';
                    var t = storageCommands.getATS();
                    data.apdu = apdu2str(t);
                    break;
                case 'loadkey':
                    data.command = 'transmit';
                    var t = storageCommands.loadKey(cmd.reader, cmd.keyname, cmd.keyvalue);
                    data.apdu = apdu2str(t);
                    break;
                case 'transmit':
                    data.command = cmd.command;
                    data.apdu = cmd.apdu;
                    break;
                case 'authenticateblock':
                    data.command = 'transmit';
                    var t = storageCommands.authenticateBlock(cmd.reader, cmd.sector,cmd.block,cmd.key_type);
                    data.apdu = apdu2str(t);
                    break;
                case 'readbinary':
                    data.command = 'transmit';
                    var t = storageCommands.readBinary(cmd.reader, cmd.sector,cmd.block);
                    data.apdu = apdu2str(t);
                    break;
                case 'readULpage':
                    data.command = 'transmit';
                    var t = storageCommands.readPage(cmd.reader, cmd.block);
                    data.apdu = apdu2str(t);
                    break;
                case 'desfire_GetApplicationIDs':
                    data.command = 'transmit';
                    var t = desfireCommands.getApplicationIDs();
                    data.apdu = apdu2str(t);
                    break;
                case 'desfire_SelectApplication':
                    data.command = 'transmit';
                    var t = desfireCommands.selectApplication(cmd.aid);
                    data.apdu = apdu2str(t);
                    break;
                case 'desfire_DeleteApplication':
                    data.command = 'transmit';
                    var t = desfireCommands.deleteApplication(cmd.aid);
                    data.apdu = apdu2str(t);
                    break;
                case 'desfire_GetKeySettings':
                    data.command = 'transmit';
                    var t = desfireCommands.getKeySettings();
                    data.apdu = apdu2str(t);
                    break;
                case 'desfire_GetKeyVersion':
                    data.command = 'transmit';
                    var t = desfireCommands.getKeyVersion(cmd.key);
                    data.apdu = apdu2str(t);
                    break;
                case 'desfire_GetDFNames':
                        data.command = 'transmit';
                        var t = desfireCommands.getDFNames();
                        data.apdu = apdu2str(t);
                        break;    
                case 'desfire_createApplication':
                    data.command = 'transmit';
                    var t = desfireCommands.createApplication(cmd.aid, cmd.keysettings1, cmd.keysettings2);
                    data.apdu = apdu2str(t);
                    break;
                case 'desfire_AESAuthenticate':
                    // Track our auth state
                    auth_keynum = cmd.key;
                    auth_keyval = CryptoJS.enc.Hex.parse(cmd.keyval);
                    debug('Initializing AES crypto', auth_keynum, auth_keyval);
                    cmd.keyval = '<hidden>';
                    data.command = 'transmit';
                    var t = desfireCommands.requestAESAuth(cmd.key);
                    data.apdu = apdu2str(t);
                    break;
                case 'desfire_AESAuthenticate_Response':
                    data.command = 'transmit';
                    var t = desfireCommands.replyAESAuth(cmd.r);
                    data.apdu = apdu2str(t);
                    break;
                case 'connect':
                case 'disconnect':
                    commandQueue.shift(); // Those commands don't reply on the 'format' channel
                    queue_busy = false;
                default:
                    data.command = cmd.command;
                    break;
            }

            cmd.apdu = data.apdu; // Tell front-end what we sent.
            console.info('Sending command', data);
            if (data.command == 'transmit') {
                // Do a bit of reformatting
                try {
                    data.apdu = [].slice.call(abutils.hextoab(data.apdu)); // Make it an array of bytes
                } catch (e) {
                    queue_busy = false;
                    commandQueue.shift();
                    self.trigger('data', { data: '', 
                        sw1sw2: 'Error, odd number of characters in APDU',
                       command: cmd } );
                }
            }
            port.write(data);

            if (queue_busy) {
                wd = setTimeout(function() {
                    queue_busy = false;
                    commandQueue.shift();
                }, 1000 );
            }
            
            // We don't shift the queue at this stage, we wait to
            // receive & process the response

        }


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

            commandQueue.push(data);
            processQueue();

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