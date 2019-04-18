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
        IsoCodes = require('app/lib/iso-codes'),
        abutils = require('app/lib/abutils'),
        template = require('js/tpl/instruments/pcsc/DesfireExplorer.js');

    // Need to load these, but no related variables.
    require('bootstrap');
    require('lib/bootstrap-treeview');

    return Backbone.View.extend({

        initialize: function (options) {
            this.currentReader = options.currentReader;
            this.parent = options.parent; // used to pass data to the APDU scripter windows
            // Because we're all async, we need to maintain a command queue...
            this.commandQueue = [];
            this.tree = {};
            this.currentAID = null;
            this.currentFile = null;
            linkManager.on('input', this.showInput, this);
        },

        events: {
            'click #loadKeyA': 'loadKeyA',
            'click #loadKeyB': 'loadKeyB',
            'click #desfire-info': 'getCardInfo',
            'click #aid-list': 'requestAIDs'
        },

        render: function (reader, atr) {
            var self = this;
            this.atr = abutils.ui8tohex(new Uint8Array(atr)).toUpperCase();;
            console.log('Main render of Desfire explorer');
            console.log(atr);
            this.$el.html(template());
            this.reader = reader;
            return this;
        },

        requestAIDs: function() {
            // If the card is open enough, then it will return a list of AIDs present
            // on it
            linkManager.sendCommand({ command:'transmit', 
                reader: this.currentReader,
                meta: "desfire_selectpiccAID",
                apdu: "905a00000300000000"
            });

            linkManager.sendCommand({ command:'transmit', 
                reader: this.currentReader,
                meta: "desfire_getaids",
                apdu: "906A000000" // DESFire Get AIDs, wrapped
            });
        },

        makeAIDMap: function(data) {
            this.tree = [];
            this.tree.push({ text: 'AID: 000000 (PICC)',  id: "000000", nodes: []});
            data = data.slice(0,-4); // Remove final response
            var knownAIDs = {};
            for (var i = 0; i < data.length/6; i++) {
                var aid = data.substr(i*6,6).toUpperCase();
                this.tree.push({ text: 'AID: ' + aid,  id: aid, nodes: []});
            }
            this.$('#memmap').treeview({ data:this.tree }).treeview('collapseAll', { silent: true });;
            this.$('#memmap').off('nodeSelected');
            this.$('#memmap').on('nodeSelected', this.aidClick.bind(this));
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

        loadKeyA: function() {
            var keyval = this.$('#keyA').val();
            linkManager.sendCommand({ command: 'loadkey', reader: this.currentReader,
                                        keyname: 'A', keyvalue: keyval});
        },

        loadKeyB: function() {
            var keyval = this.$('#keyB').val();
            linkManager.sendCommand({ command: 'loadkey', reader: this.currentReader,
                                        keyname: 'B', keyvalue: keyval});
        },


        onClose: function () {
            console.log("Mifare explorer view closing...");
            linkManager.off('input', this.showInput);
            this.$('#memmap').off('nodeSelected');
        },

        aidClick: function(e, data) {
            console.log(data);
            var knownAIDs = { 
                "FFFFFF": "General Issuer Info"
            };
            switch (data.id.length) {
                case 6: // This is an AID
                    var aid = data.id;
                    var c = "<b>AID " + aid;
                    if (knownAIDs[aid] != undefined) c += " - " + knownAIDs[aid];
                    c += "</b></br>";
                    this.$('#hexdump').html(c);
                    var apdu = "905a000003" + aid + "00";
                    linkManager.sendCommand({ command:'transmit', 
                        reader: this.currentReader,
                        meta: "desfire_selectaid",
                        aid: aid,
                        apdu: apdu
                    });
                    break;
                case 2:
                    // If the file belongs to another AID, then select that AID first
                    var aid = this.$('#memmap').treeview('getNode',data.parentId).id;
                    if (aid != this.currentAID) {
                        var apdu = "905a000003" + aid + "00";
                        linkManager.sendCommand({ command:'transmit', 
                            reader: this.currentReader,
                            meta: "desfire_selectaid",
                            dontgetfids: true,
                            apdu: apdu
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

        parseVersion(frameNumber, data) {
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

        // Parse file info and also trigger file content read if possible
        parseFileInfo(data) {
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
                if (key ==  0) r += " (master)";
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

            if (data.command) {
                if (data.command.command == 'loadkey') {
                    if (data.data == "9000") {
                        this.$('#key' + data.command.keyname).css('background-color', '#d9eeda');
                    } else {
                        this.$('#key' + data.command.keyname).css('background-color','#f2dede');
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
                    this.makeAIDMap(data.data);
                }
                if (data.command.meta == "desfire_selectaid") {
                    this.currentAID = data.command.aid;
                    // Populate info about the AID
                    if (data.command.dontgetfids == undefined)
                        linkManager.sendCommand({ command:'transmit', 
                            reader: this.currentReader,
                            meta: "desfire_getfileids",
                            aid: data.command.aid,
                            apdu: "906F000000"
                        });
                }
                if (data.command.meta == "desfire_readbinary") {
                    var c = this.$('#hexdump').html();
                    if (data.data.slice(-4) != "9100") {
                        c += "<b>Error reading file</b>"
                    } else {
                        c += "<b>File contents:</b></br><pre>";
                        c += abutils.hexdump(abutils.hextoab(data.data.substr(0,data.data.length-4))) + '\n';
                        c += "</pre>";
                    }

                    this.$('#hexdump').html(c);
                }
                if (data.command.meta == 'desfire_getfileids') {
                    // Find the node for that AID, add the fileIDs
                    if (data.data.slice(-4) != "9100") {
                        this.$('#hexdump').html("Could not read the files in that AID");
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
                if (data.command.command == 'readbinary') {
                    if (data.data.slice(-4) == "9000") {
                        this.hexdumpContents += abutils.hexdump(abutils.hextoab(data.data.substr(0,data.data.length-4))) + '\n';                                                
                        if (data.command.block == 3) {
                            this.hexdumpContents += '</pre><br>' +
                                        this.decodeTrailer(data.data.substr(0,data.data.length-4));
                            this.$('#hexdump').html(this.hexdumpContents);
                        } else if (this.commandQueue.length == 0) {
                            this.hexdumpContents += '</pre>';
                            this.$('#hexdump').html(this.hexdumpContents);
                        }
                    } else {
                        // We were not able to read the sector, tell the user
                        var c = this.$('#hexdump').html();
                        this.$('#hexdump').html(c + '<br>' + 'Sector: ' + data.command.sector +
                        ' Block:' + data.command.block + ' - ' + data.sw1sw2 );
                    }
                }
            }

            if (this.commandQueue.length) {
                linkManager.sendCommand(this.commandQueue.shift());
            }
        },



    });

});