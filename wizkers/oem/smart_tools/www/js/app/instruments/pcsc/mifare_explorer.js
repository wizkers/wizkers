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
 * Mifare Explorer
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        abutils = require('app/lib/abutils'),
        template = require('js/tpl/instruments/pcsc/MifareExplorer.js');

    // Need to load these, but no related variables.
    require('bootstrap');
    require('lib/bootstrap-treeview');

    return Backbone.View.extend({

        initialize: function (options) {

            linkManager.on('input', this.showInput, this);
        },

        events: {
            'click .node-selected': 'sectorClick'
        },

        render: function (reader, atr) {
            var self = this;
            this.atr = abutils.ui8tohex(new Uint8Array(atr)).toUpperCase();;
            console.log('Main render of Mifare explorer');
            console.log(atr);
            this.$el.html(template());
            this.reader = reader;
            // Initialize mapping depending on card type:
            // Mifare 1K is 16 sectors with 4 blocks of 16 bytes each
            // Mifare 4K is 31 sectors with 4 blocks and the rest with 16 blocks
            // Mifare Ultralight is 16 pages of 4 bytes...
            switch(this.atr) {
                case "3B8F8001804F0CA000000306030001000000006A":
                    this.mifareCardType = "1K";
                    this.mifareCardSectors = 16;
                    break;
                case "3B8F8001804F0CA0000003060300020000000069":
                    this.mifareCardType = "4K";
                    this.mifareCardSectors = 40;
                    break;
                case "3B8F8001804F0CA0000003060300030000000068":
                    this.mifareCardType = "Ultralight";
                    this.mifareCardSectors = 16;
                    break;
                default:
                    this.mifareCardType = "1K";
                    this.mifareCardSectors = 16;
            }
            this.makeMemoryMap();

            return this;
        },

        makeMemoryMap: function() {
            var memmap = [];
            for (var i = 0; i < this.mifareCardSectors; i++) {
                memmap.push({ text: 'Sector ' + i});
            }
            this.$('#memmap').treeview({ data:memmap });
            this.$('#memmap').off('nodeSelected');
            this.$('#memmap').on('nodeSelected', this.sectorClick);
        },

        /*
        * Decodes a sector trailer into a table of access rights.
        *
        * Either I'm dumb, or there is no logical way to compute access
        * rights from the value, except by a lookup into a static access
        * right table, hence the big HTML human-readable arrays below.
        *
        * Trailer is a hex string (16 bytes, i.e. 32 hex characters)
        */
        decodeTrailer: function(trailer) {

            var trailerReadableTable = [
                "<td>never</td><td>key A</td><td>key A</td><td>never</td><td>key A</td><td>key A</td><td>Key B may be read</td>",
                "<td>never</td><td>key A</td><td>key A</td><td>key A</td><td>key A</td><td>key A</td><td>Key B may be read,transport configuration</td>",
                "<td>never</td><td>never</td><td>key A</td><td>never</td><td>key A</td><td>never</td><td>Key B may be read</td>",
                "<td>never</td><td>key B</td><td>key A|B</td><td>key B</td><td>never</td><td>key B</td><td></td>",
                "<td>never</td><td>key B</td><td>key A|B</td><td>never</td><td>never</td><td>key B</td><td></td>",
                "<td>never</td><td>never</td><td>key A|B</td><td>key B</td><td>never</td><td>never</td><td></td>",
                "<td>never</td><td>never</td><td>key A|B</td><td>never</td><td>never</td><td>never</td><td></td>",
                "<td>never</td><td>never</td><td>key A|B</td><td>never</td><td>never</td><td>never</td><td></td>"];

            var blockReadableTable = [
                "<td>Key A|B</td><td>Key A|B</td><td>Key A|B</td><td>Key A|B</td><td>Transport configuration</td>",
                "<td>Key A|B</td><td>never</td><td>never</td><td>Key A|B</td><td>Value block</td>",
                "<td>Key A|B</td><td>never</td><td>never</td><td>never</td><td>read/write block</td>",
                "<td>Key B</td><td>Key B</td><td>never</td><td>never</td><td>read/write block</td>",
                "<td>Key A|B</td><td>Key B</td><td>never</td><td>never</td><td>read/write block</td>",
                "<td>Key B</td><td>never</td><td>never</td><td>never</td><td>read/write block</td>",
                "<td>Key A|B</td><td>Key B</td><td>Key B</td><td>Key A|B</td><td>Value block</td>",
                "<td>never</td><td>never</td><td>never</td><td>never</td><td>read/write block</td"];

            // We won't check the validity of inverted bits in the trailer, we'll just
            // isolate the actual values. I'm not inspired and a bad codewriter, but at least
            // this should work: if anyone has a better idea, be my guest (and please share)
            var b7 = parseInt(trailer.substr(14,2),16);
            var b8 = parseInt(trailer.substr(16,2),16);
            var b0acl = ((b7 & 0x10) >>> 2) +((b8 & 0x1) << 1) +((b8 & 0x10) >>> 4);
            var b1acl = ((b7 & 0x20) >>> 3) +((b8 & 0x2 )) + ((b8 & 0x20) >>> 5);
            var b2acl = ((b7 & 0x40) >>> 4) + ((b8 & 0x4) >>> 1) + ((b8 & 0x40) >>> 6);
            var b3acl = ((b7 & 0x80) >>> 5) + ((b8 & 0x8) >>> 2) + ((b8 & 0x80) >>> 7);

            var aclTable = "<table class='mifareACLTable'><tr><th colspan=2></th><th colspan=4>Access Condition for</th><th></th></tr><tr><th>Block number</th><th>ACL</th><th>Read</th><th>Write</th><th>Increment</th><th>Decrement,<br>transfer,<br>restore</th><th>Remark</th></tr>";
            aclTable += "<tr><td>Block 0</td><td>" + b0acl.toString(2) + "</td>" + blockReadableTable[b0acl] + "</tr>";
            aclTable += "<tr><td>Block 1</td><td>" + b1acl.toString(2) + "</td>" + blockReadableTable[b1acl] + "</tr>";
            aclTable += "<tr><td>Block 2</td><td>" + b2acl.toString(2) + "</td>" + blockReadableTable[b2acl] + "</tr></table>";
            aclTable += "<br><table class='mifareACLTable'><tr><th rowspan=3>Trailer<br>Access bits<br>value</th><th colspan=6>Access Condition for</th><th rowspan=3>Remark</th></tr>";
            aclTable += "<tr><th colspan=2>Key A</th><th colspan=2>Access bits</th><th colspan=2>Key B</th>";
            aclTable += "<tr><th>read</th><th>write</th><th>read</th><th>write</th><th>read</th><th>write</th>";
            aclTable += "<tr><td>" + b3acl.toString(2) + "</td>" + trailerReadableTable[b3acl] + "</tr></table>";
            aclTable += "<br><b>Note:</b>If Key B may be read in the corresponding Sector Trailer it cannot serve for authentication.<br><b>Consequence:</b> If the Reader tries to authenticate any block of such a sector with key B, the card will refuse any subsequent memory access after authentication.";

            return aclTable;
        },

        onClose: function () {
            console.log("Mifare explorer view closing...");
            linkManager.off('input', this.showInput);
            this.$('#memmap').off('nodeSelected');
        },

        sectorClick: function(e, data) {
            console.log(data);
        },

        // We get there whenever we receive something from the serial port
        showInput: function (data) {
            var self = this;
            console.log('Data', data);
        },



    });

});