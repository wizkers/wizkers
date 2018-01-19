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
 * Live view display of the output of the Kestrel weather stations
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
        cardident = require('js/app/instruments/mifare/card_identifier.js'),
        template = require('js/tpl/instruments/mifare/LiveView.js');

    require('lib/bootstrap-treeview');

    return Backbone.View.extend({

        initialize: function (options) {

            this.update_count = 0;
            this.datasetlength = 0;

            this.readerlist = [];

            if (vizapp.type == 'cordova') {
                var wz_settings = instrumentManager.getInstrument().get('wizkers_settings');
                if (wz_settings) {
                    if (wz_settings.screen_no_dim == 'true') {
                        keepscreenon.enable();
                    } else {
                        keepscreenon.disable();
                    }
                } else {
                    // Happens when the user never explicitely set the screen dim
                    keepscreenon.disable();
                }
            }

            linkManager.on('status', this.updatestatus, this);
            linkManager.on('input', this.showInput, this);

        },


        events: {},

        render: function () {
            var self = this;
            console.log('Main render of Mifare view');
            this.$el.html(template());

            // Initialize a reader tree view
            this.$('#readers').treeview({ data:this.readerlist});

            linkManager.requestStatus();
            linkManager.getUniqueID(); // Actually gets the list of readers
            return this;
        },

        onClose: function () {
            console.log("Mifare live view closing...");
            linkManager.stopLiveStream();
            linkManager.off('status', this.updatestatus);
            linkManager.off('input', this.showInput);
        },

        updatestatus: function (data) {
            console.log("Mifare live display: link status update");
        },

        clear: function () {
            console.log('Clear');
        },

        formatAtr: function(atr) {
            var atrinfo = cardident.parseATR(atr);
            this.$('#atrinfo').html(atrinfo);
            return abutils.ui8tohex(new Uint8Array(atr));
        },


        // We get there whenever we receive something from the serial port
        showInput: function (data) {
            var self = this;

            if (data.device) {
                // Old school loops are still the fastest
                for (var i = 0; i < this.readerlist.length; i++) {
                    if (this.readerlist[i].text == data.device) {
                        if (data.action == 'removed') {
                            this.readerlist.splice(i,1);
                            this.$('#readers').treeview({ data:this.readerlist});
                            return;
                        }
                    }
                }
                if (data.action != 'added')
                    return;``
                // Didn't find the device
                this.readerlist.push({ text: data.device, nodes: []});
                this.$('#readers').treeview({ data:this.readerlist});
                return;
            }

            // Present when card inserted/removed
            if (data.status) {
                if (data.status == 'card_inserted') {
                    for (var i = 0; i < this.readerlist.length; i++) {
                        if (this.readerlist[i].text == data.reader) {
                            this.readerlist[i].nodes.push({text:this.formatAtr(data.atr)});
                        }
                    }
                } else if (data.status == 'card_removed') {
                    for (var i = 0; i < this.readerlist.length; i++) {
                        if (this.readerlist[i].text == data.reader) {
                            this.readerlist[i].nodes = [];
                        }
                    }
                }
                this.$('#readers').treeview({ data:this.readerlist});

            }

            console.log('Data', data);

        },
    });

});