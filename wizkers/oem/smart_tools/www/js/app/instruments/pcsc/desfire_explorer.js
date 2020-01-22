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

/*
 * Mifare Desfire Explorer
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        bootbox = require('bootbox'),
        IsoCodes = require('app/lib/iso-codes'),
        abutils = require('app/lib/abutils'),
        template = require('js/tpl/instruments/pcsc/DesfireExplorer.js');

    // Need to load these, but no related variables.
    require('bootstrap');
    require('lib/bootstrap-treeview');

    var knownAIDs = {
        "000000": "PICC Master application",
        "010000": "NDEF Application",
        "FFFFFF": "General Issuer Info",
        "5354FF": "Identiv TS access control",
        "F48120": "Gallagher access control",
        "F48121": "Gallagher access control",
        "F48122": "Gallagher access control",
        "F48123": "Gallagher access control",
        "F48124": "Gallagher access control",
        "F48125": "Gallagher access control",
        "F48126": "Gallagher access control",
        "F48127": "Gallagher access control",
        "F48128": "Gallagher access control",
        "F48129": "Gallagher access control",
        "F4812A": "Gallagher access control",
        "F4812B": "Gallagher access control",
        "F4812F": "Gallagher Card Application Directory",
        // See NXP AN10957 for details
        "F531C0": "Siemens access control",
        "F532F0": "Generic physical access control",
        "F532F1": "Generic physical access control",
        "F532F2": "Generic physical access control",
        "F532F3": "Generic physical access control",
        "F532F4": "Generic physical access control",
        "F532F5": "Generic physical access control",
        "F532F6": "Generic physical access control",
        "F532F7": "Generic physical access control",
        "F532F8": "Generic physical access control",
        "F532F9": "Generic physical access control",
        "F532FA": "Generic physical access control",
        "F532FB": "Generic physical access control",
        "F532FC": "Generic physical access control",
        "F532FD": "Generic physical access control",
        "F532FE": "Generic physical access control",
        "F532FF": "Generic physical access control"
    };

    return Backbone.View.extend({

        initialize: function (options) {
            this.currentReader = options.currentReader;
            this.parent = options.parent; // used to pass data to the APDU scripter windows
            // Because we're all async, we need to maintain a command queue...
            this.commandQueue = [];
            this.tree = {};
            this.currentAID = null;
            this.currentFile = null;
            this.cryptoType = 0;
            linkManager.on('input', this.showInput, this);
        },

        events: {
            'click #desfire-info': 'getCardInfo',
            'click #aid-list': 'requestAIDs',
            'click #desfire-deleteapp': 'deleteApp',
            'click #desfire-createapp': 'createApp',
            'click #desfire-createapp2': 'createApp2',
            'click #key0Auth' : 'keyAuth',
            'change #key0': 'updateUsableKeys',
            'click #desfire-createfile': 'createDatafile'
        },

        render: function (reader, atr) {
            this.atr = abutils.ui8tohex(new Uint8Array(atr)).toUpperCase();;
            console.log('Main render of Desfire explorer');
            console.log(atr);
            this.$el.html(template());
            this.reader = reader;
            return this;
        },

        keyAuth: function(event) {
            var keys = [ "key0Auth", "key1Auth", "key2Auth", "key3Auth"];
            var keyvals = [ "key0", "key1", "key2", "key3"];
            var keyval = this.$("#" + keyvals[keys.indexOf(event.target.id)]).val();

            linkManager.sendCommand({ command:'desfire_AESAuthenticate',
                reader: this.currentReader,
                crytoType: this.cryptoType,
                key: keys.indexOf(event.target.id),
                keyval: keyval
            });
        },

        deleteApp: function (event) {
            var self = this;
            // Use Bootbox for a quick OK/Cancel confirmation
            bootbox.confirm("Are you sure you want to delete this application?<br>AID: " + this.currentAID, function (result) {
                if (result) {
                    linkManager.sendCommand({ command: 'desfire_DeleteApplication', reader: self.currentReader,
                    aid: self.currentAID});
                }
            });
            return false; // stop propagation
        },

        createApp: function() {
            this.$('#appCreateModal').modal('show');
        },

        createApp2: function() {
            var aid = this.$('#applicationAID').val();
            var kck = parseInt(this.$('#keyChangeKey').val());
            var cch = this.$('#configChange').prop('checked');
            var cdl = this.$('#createDelete').prop('checked');
            var dir = this.$('#directoryList').prop('checked');
            var mch = this.$('#masterKeyChange').prop('checked');

            var keySettings1 = kck << 4;
            if (cch) keySettings1 |= 0b1000;
            if (cdl) keySettings1 |= 0b0100;
            if (dir) keySettings1 |= 0b0010;
            if (mch) keySettings1 |= 0b0001;
            console.log('Key settings 1', keySettings1.toString(2));

            var knb = parseInt(this.$('#keysInApp').val());
            var kal = parseInt(this.$('#keyAlgo').val());
            var keySettings2 = knb;
            keySettings2 |= kal << 6;
            console.log('Key settings 2', keySettings2.toString(2));

            // Note: we don't support ISO file ID / DF name for now, maybe later ?
            linkManager.sendCommand({
                command:'desfire_createApplication',
                reader: this.currentReader,
                aid: aid,
                keysettings1: keySettings1,
                keysettings2: keySettings2
            });

        },

        createDatafile: function (event) {
            console.log("Create data file - to be implemented");
        },

        requestAIDs: function() {
            // If the card is open enough, then it will return a list of AIDs present
            // on it
            linkManager.sendCommand({ command:'desfire_SelectApplication', 
                reader: this.currentReader,
                aid: "000000",
                dontgetfids: true
            });

            this.currentAIDList = ""; // Reset the list
            this.currentDFList = "";
            
            linkManager.sendCommand({ command:'desfire_GetApplicationIDs', 
                reader: this.currentReader,
                meta: "desfire_getaids"
            });

            // Reset the auth settings & colors
            var slots = ['#key0', '#key1', '#key2', '#key3'];
            for (var key in slots) {
                var slot = this.$(slots[key]);
                var button = this.$(slots[key]+"Auth");
                slot.css('background-color', '');
                button.removeClass('btn-success').removeClass('btn-danger');
            }
        },

        makeAIDMap: function(data, dfs) {

            // Process the list of DFs and index it by AID index
            // TODO

            this.tree = [];
            this.tree.push({ text: 'AID: 000000 (PICC)',  id: "000000", nodes: []});
            var c = "<b>Card applications</b><br><table class=\"table table-striped\"><tr><th>AID</th><th>Description</th></tr>";
            for (var i = 0; i < data.length/6; i++) {
                var aid = data.substr(i*6,6).toUpperCase();
                this.tree.push({ text: 'AID: ' + aid,  id: aid, nodes: []});
                c += "<tr><td>" + aid + "</td><td>" + (knownAIDs[aid] ? knownAIDs[aid] : "Unknown application") + "</td></tr>";
            }
            c += "</table>";
            this.$('#memmap').treeview({ data:this.tree }).treeview('collapseAll', { silent: true });;
            this.$('#memmap').off('nodeSelected');
            this.$('#memmap').on('nodeSelected', this.aidClick.bind(this));
            this.$("#hexdump").html(c);
        },

        getCardInfo: function() {
            linkManager.sendCommand({ command:'transmit', 
                reader: this.currentReader,
                meta: "desfire_getversion_1",
                apdu: "9060000000" // DESFire GetVersion command 1, wrapped
            });
            linkManager.sendCommand({ command:'transmit', 
                reader: this.currentReader,
                meta: "desfire_getversion_2",
                apdu: "90AF000000" // DESFire GetVersion command 2
            });
            linkManager.sendCommand({ command:'transmit', 
                reader: this.currentReader,
                meta: "desfire_getversion_3",
                apdu: "90AF000000" // DESFire GetVersion command 1, wrapped
            });
        },

        onClose: function () {
            console.log("Mifare explorer view closing...");
            linkManager.off('input', this.showInput);
            this.$('#memmap').off('nodeSelected');
        },

        aidClick: function(e, data) {
            console.log(data);
            switch (data.id.length) {
                case 6: // This is an AID
                    var aid = data.id;
                    var c = "<b>AID " + aid;
                    if (knownAIDs[aid] != undefined) c += " - " + knownAIDs[aid];
                    c += "</b></br>";
                    if (aid == "000000") {
                        // This is the master AID, insert possible actions here
                        c += "<button class=\"btn btn-info btn-sm\" id=\"desfire-createapp\">Create application</button>";
                    } else {
                        c += "<button class=\"btn btn-danger btn-sm\" id=\"desfire-deleteapp\">Delete application</button>";
                        c += "<button class=\"btn btn-info btn-sm\" id=\"desfire-createfile\" disabled >Create  Data file</button>";
                        c += "<button class=\"btn btn-info btn-sm\" id=\"desfire-createvaluefile\" disabled >Create  Value file</button>";
                    }
                    c += "</br>";
                    this.$('#hexdump').html(c);
                    linkManager.sendCommand({ command:'desfire_SelectApplication', 
                        reader: this.currentReader,
                        aid: aid
                    });
                    break;
                case 2:
                    // If the file belongs to another AID, then select that AID first
                    var aid = this.$('#memmap').treeview('getNode',data.parentId).id;
                    if (aid != this.currentAID) {
                        linkManager.sendCommand({ command:'desfire_SelectApplication',
                            reader: this.currentReader,
                            dontgetfids: true,
                            aid: aid
                        });
                    }
                    var apdu = "90F5000001" + data.id + "00";
                    linkManager.sendCommand({ command:'transmit', 
                        reader: this.currentReader,
                        meta: "desfire_getfilesettings",
                        aid: this.currentaid,
                        fid: data.id,
                        apdu: apdu
                    });
                    break;
            }
        },

        parseVersion: function(frameNumber, data) {
            var c = this.$('#hexdump').html();
            var d = abutils.hextoab(data);
            if (frameNumber == 1) {
                c = "";
                // Byte 0 is Vendor ID
                // Byte 1-2 is type and subtype
                // Byte 3-4 is major and minor versions
                // Byte 5 is storage size
                // Byte 6 is communication protocol type
                c += "IC Vendor: " + IsoCodes.ICmanufacturerMapping[d[0]];
                c += "<br>IC Type/Subtype: " + d[1].toString(16) + "/" + d[2].toString(16) + "</br>";
                c += "Major/Minor versions: " + d[3] + "." + d[4] + " (";
                if ( d[3] == 0x00)
                    c += "Desfire MF3ICD40";
                else if (d[3] == 0x01 && d[4] == 0x00)
                    c += "Desfire EV1";
                else if (d[3] == 0x12 && d[4] == 0x00)
                    c += "Desfire EV2";
                else
                    c += "Unknown";
                c += ")</br>Storage size: ";
                var ss = 2 ** (d[5] >> 1);
                c += ss + " bytes (";
                c += (d[5] & 0x01) ? "Actually between " + ss + " and " + ss*2 : "Exactly";
                c += ")</br>";
            } else if (frameNumber == 2) {
                c += "</br>Unique ID: " + data.substr(0,14);
                c += "</br>Production batch number: " + data.substr(14,10);
                // The next two values are in BCD ! So we need to take the values literally: 0x18 = 2018
                c += "</br>Production week: " + data.substr(24,2);
                c += "</br>Production year: " + (2000+parseInt(data.substr(26,2)));
            }

            this.$('#hexdump').html(c);                    

        },

        parseKeySettings: function(data) {
            var c = this.$('#hexdump').html();
            var d = abutils.hextoab(data);

            var numkeys = d[1] & 0b00111111;

            c += "<br>Number of keys in this application: " + numkeys;
            c += "<br>Key type: ";
            switch ( d[1] >> 6) {
                case 0:
                    c += "DES/2K3DES";
                    break
                case 1:
                    c += "3K3DES";
                    break;
                case 2:
                    c += "AES";
                    break;
                default:
                    c += "Parsing error";
            }
            this.cryptoType = d[1] >>6; // Save if we want to authenticate later on
            this.updateUsableKeys();

            c += "<br>Key settings value: 0x" + d[0].toString(16) + "<br>";
            if (this.currentAID != "000000") {
                // Bits 5 to 7 are only meaningful for AID != 0x00
                switch (d[0] & 0xb11110000) {
                    case 0x0:
                        c += "Application master key authentication is necessary to change any key (default)";
                        break;
                    case 0xe:
                        c += "Authentication with the key to be changed (same KeyNo) is necessary to change a key";
                        break;
                    case 0xf:
                        c += "All keys (except application master key, see \"configuration changeable below\") within this application are frozen";
                        break;
                    default:
                        c += "Authentication with key 0x" + (d[0] & 0xb11110000).toString() + " is necessary to change any key. Master key and key 0x"
                        + (d[0] & 0xb11110000).toString() + " can only be changed after master key auythentication";
                        break;
                }
                c += "<br>";
            }

            this.currentAID == "000000" ? c += "PICC" : "Application";
            c += ( d[0] & 0b0001) ? " Master key can be changed<br>" : " Master key cannot be changed<br>";
            this.currentAID == "000000" ? c += "PICC" : "Application";
            c += ( d[0] & 0b0010) ? " Master key not required for directory list<br>" : " Master key required for directory list<br>";
            this.currentAID == "000000" ? c += "PICC" : "Application";
            c += ( d[0] & 0b0100) ? " Master key not required for create/delete " : " Master key required for create/delete ";
            this.currentAID == "000000" ? c += "applications<br>" : "files<br>";
            c += ( d[0] & 0b1000) ? "Key configuration changeable if authenticated by " + (this.currentAID == "000000" ? "PICC" : "Application") + " master key" : "Key configuration not changeable (frozen)<br>";
            c += "<div id=\"keyvers\"></div>";

            this.$('#hexdump').html(c);

            for (var i = 0; i < numkeys; i++ ) {
                linkManager.sendCommand({ command: 'desfire_GetKeyVersion',
                            reader: this.currentReader,
                            key: i
                        });
            }

            return d[0] & 0b0010; // Whether files can be read for this AID

        },

        updateUsableKeys: function() {
            // Loop over all our key slots, and color the ones that can be used for the current required crypto
            // in the right color
            var slots = ['#key0', '#key1', '#key2', '#key3'];
            for (var key in slots) {
                var slot = this.$(slots[key]);
                var val = slot.val();
                var len = 0;
                if (val != undefined) {
                    len = val.length
                }
                var bg;
                switch (this.cryptoType) {
                    case 0: // DES
                        (len == 16) ? bg ='#d9eeda' : bg = '#f2dede';
                        break;
                    case 1: // 3KDES
                        (len == 16) ? bg ='#d9eeda' : bg = '#f2dede';
                        break;
                    case 2: // AES
                        (len == 32) ? bg ='#d9eeda' : bg = '#f2dede';
                        break;
                }
                slot.css('background-color', bg);
            }

        },

        // Parse file info and also trigger file content read if possible
        parseFileInfo: function(data) {
            var c = "<b>File information</b></br>";
            var d = abutils.hextoab(data);

            // Byte 1 is file type:
            var fileTypes = [ "Standard data file", "Backup data file", 
            "Value file with backup", "Linear record file with backup", "Cyclic record file with backup"];
            c += "File type: " + d[0] + " - " + fileTypes[d[0]];
            c += "</br>Communication settings: " + d[1] + " - ";
            d[1] = d[1] & 0x03;
            switch (d[1]) {
                case 0x0:
                case 0x2:
                    c += "Plain communication";
                    break;
                case 0x01:
                    c += "Plain communication secured by MACing";
                    break;
                case 0x03:
                    c += "Fully enciphered communication";
                    break;
            }
            var formatKey = function(key) {
                var r = "<td> Key 0x" + key.toString(16);
                if (key == 14) r += " (free access)";
                if (key == 15) r += " (deny access)";
                // if (key ==  0) r += " (master)";
                r += "</td>";
                return r;
            }
            var canRead = false;
            c += "</br>Access rights:" ;
            c += "<table class=\"table table-striped\"><tr><th>Read acess</th><th>Write access</th><th>RW access</th><th>Change access rights</th></tr><tr>";
            var ra = d[3] >> 4;
            c += formatKey(ra);
            canRead |= ra == 0xe;
            ra = d[3] & 0xf;
            c += formatKey(ra);
            var ra = d[2] >> 4;
            c += formatKey(ra);
            canRead |= ra == 0xe;
            ra = d[2] & 0xf;
            c += formatKey(ra);
            c += "</tr></table";
            this.$('#hexdump').html(c);

            if (canRead) {
                linkManager.sendCommand({ command:'transmit', 
                    reader: this.currentReader,
                    meta: "desfire_readbinary",
                    apdu: "90BD000007" + ("00" + this.currentFile).slice(-2) + "00000000000000"
                });
            }

        },

        // We get there whenever we receive something from the serial port
        showInput: function (data) {
            var self = this;
            console.log('Data', data);
            if (data.status == 'disconnected') {
                // Card was removed: stop listening to future messages
                console.log('Card remove, stop listening to data');
                linkManager.off('input', this.showInput);
                this.$el.css('opacity',0.6);
            }

            if (data.command) {
                if( data.command.command == 'desfire_createApplication') {
                    if (data.data.slice(-4) != "9100") {
                        this.$('#desfire-createapp2').addClass('btn-danger');
                        return;
                    } else {
                        // Success! Close the dialog and refresh AIDs
                        this.$('#appCreateModal').modal('hide');
                        this.requestAIDs();
                    }
                }
                if (data.command.meta == 'desfire_getversion_1') {
                    if (data.data.slice(-4) != "91af" && data.data.slice(-4) != "9100") {
                        this.$('#hexdump').html('Error sending GetVersion command');
                        return;
                    }
                    this.parseVersion(1, data.data);
                }
                if (data.command.meta == 'desfire_getversion_3') {
                    if (data.data.slice(-4) != "9100") {
                        this.$('#hexdump').html('Error sending GetVersion command');
                        return;
                    }
                    this.parseVersion(2, data.data);
                }
                if (data.command.meta == 'desfire_getaids') {
                    if (data.data.slice(-4) != "9100") {
                        this.$('#hexdump').html('Error sending Get Application IDs command');
                        return;
                    }
                    if (data.data.slice(-4) == '91af') {
                        this.currentAIDList += data.data.slice(0,-4);
                        linkManager.sendCommand({ command:'transmit', 
                            reader: this.currentReader,
                            apdu: "90AF000000",
                            meta: 'desfire_getaids'
                        });
                    } else {
                        this.currentAIDList += data.data.slice(0,-4);   
                        // WARNING: no support for multiple bocks of DFs
                        linkManager.sendCommand({ command:'desfire_GetDFNames', 
                        reader: this.currentReader,
                        meta: 'desfire_getdfnames'
                        });    
                    }

                    return;
                }
                if (data.command.meta == 'desfire_getdfnames') {
                    if (data.data.slice(-4) != "9100") {
                        return;
                    }
                    if (data.data.slice(-4) == '91af') {
                        this.currentDFList += data.data.slice(0,-4);
                        linkManager.sendCommand({ command:'transmit', 
                            reader: this.currentReader,
                            apdu: "90AF000000",
                            meta: 'desfire_getdfnames'
                        });
                    } else {
                        this.currentDFList += data.data.slice(0,-4);
                        this.makeAIDMap(this.currentAIDList, this.currentDFList);
                    }
                    return;
                }
                if (data.command.command == "desfire_SelectApplication") {
                    if (data.data.slice(-4) != "9100") {
                        this.$('#hexdump').html('Error selecting Application ID');
                        return;
                    }
                    this.currentAID = data.command.aid;
                    // Populate info about the AID
                    if (data.command.dontgetfids == undefined) {
                        // Ask to get the key settings for that application
                        linkManager.sendCommand({ command: 'desfire_GetKeySettings',
                            reader: this.currentReader,
                        });
                        linkManager.sendCommand({ command:'transmit', 
                            reader: this.currentReader,
                            meta: "desfire_getfileids",
                            aid: data.command.aid,
                            apdu: "906F000000"
                        });
                    }
                }
                if (data.command.command == 'desfire_GetKeySettings') {
                    if (data.data.slice(-4) != "9100") {
                        this.$('#hexdump').html('Error getting key settings');
                        return;
                    }
                    this.parseKeySettings(data.data);
                }
                if (data.command.command == 'desfire_GetKeyVersion') {
                    if (data.data.slice(-4) != "9100") {
                        this.$('#hexdump').html('Error getting key settings');
                        return;
                    }
                    var c  = this.$('#keyvers').html();
                    c += "<br>Key " + data.command.key;
                    (data.command.key == 0) ? c += " (Master key)" : "";
                    c +=  " version:" + parseInt(data.data.substr(0,2), 16);
                    this.$('#keyvers').html(c);
                }
                if (data.command.command == 'desfire_DeleteApplication') {
                    if (data.data.slice(-4) != "9100") {
                        bootbox.alert("Error deleting application:<br>" + data.sw1sw2);
                        return;
                    }
                    this.requestAIDs();
                    return;
                }
                if (data.command.meta == "desfire_readbinary") {
                    var c = this.$('#hexdump').html();
                    if (data.data.slice(-4) != "9100") {
                        c += "<b>Error reading file</b>"
                    } else {
                        c += "<b>File contents:</b></br><pre>";
                        c += abutils.hexdump(abutils.hextoab(data.data.substr(0,data.data.length-4))).replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#039;") + '\n';
                        c += "</pre>";
                    }

                    this.$('#hexdump').html(c);
                }
                if (data.command.meta == 'desfire_getfileids') {
                    // Find the node for that AID, add the fileIDs
                    if (data.data.slice(-4) != "9100") {
                        var c = this.$('#hexdump').html();
                        this.$('#hexdump').html(c + "<br><b>Could not read the files in that AID</b>");
                        return;
                    }
                    var flist = data.data.slice(0,-4);
                    var fids = [];
                    for (var i = 0; i < flist.length/2; i++) {
                        var fid = data.data.substr(i*2,2);
                        fids.push({ text: 'File: ' + fid,  id: fid, nodes: []});
                    }
                    // Now find the tree node with our AID and update it:
                    for (var idx in  this.tree) {
                        var n = this.tree[idx];
                        if (n.id == data.command.aid)
                            this.tree[idx].nodes = fids;
                    }
                    this.$('#memmap').treeview({ data:this.tree });
                    this.$('#memmap').off('nodeSelected');
                    this.$('#memmap').on('nodeSelected', this.aidClick.bind(this));        

                }
                if (data.command.meta == 'desfire_getfilesettings') {
                    if (data.data.length== 4) {
                        this.$('#hexdump').html("Error getting file settings");
                        return;
                    }
                    this.currentFile = data.command.fid;
                    this.parseFileInfo(data.data);

                }
                if (data.command.command == 'desfire_AESAuthenticate_Response') {
                    if (data.sw1sw2 && data.sw1sw2 == 'Authentication success') {
                        this.$('#key' + data.command.key + 'Auth').addClass('btn-success').removeClass('btn-danger');
                    } else {
                        this.$('#key' + data.command.key + 'Auth').addClass('btn-danger').removeClass('btn-success');
                    }
                }
            }

            if (this.commandQueue.length) {
                linkManager.sendCommand(this.commandQueue.shift());
            }
        },



    });

});