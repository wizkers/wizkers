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
 * Live view display of PCSC Card readers
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
        cardident = require('js/app/instruments/pcsc/card_identifier.js'),
        template = require('js/tpl/instruments/pcsc/LiveView.js');

    // Need to load these, but no related variables.
    require('bootstrap');
    require('lib/bootstrap-treeview');

    return Backbone.View.extend({

        initialize: function (options) {

            this.update_count = 0;
            this.datasetlength = 0;

            this.readerlist = [];
            this.currentReader = undefined;

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


        events: {
            'click .utility_close': 'closeUtil',
            'click #apdusend': 'apduSend',
            'click #connectcard': 'connectCard',
        },

        render: function () {
            var self = this;
            console.log('Main render of PCSC view');
            this.$el.html(template());

            linkManager.requestStatus();
            linkManager.getUniqueID(); // Actually gets the list of readers
            return this;
        },

        onClose: function () {
            console.log("PCSC live view closing...");
            linkManager.stopLiveStream();
            linkManager.off('status', this.updatestatus);
            linkManager.off('input', this.showInput);
        },

        appendToResponse: function(str) {
            var i = this.$('#cardresponse');
            i.val(i.val() + str );
            // Autoscroll:
            i.scrollTop(i[0].scrollHeight - i.height());
        },

        closeUtil: function(e) {
            var utility = $(e.currentTarget).data("utility");
            // Empty the tab
            $(e.currentTarget).parent().parent().remove()
            this.$('#' + utility).remove();
            this.$('#utilities a:first').tab('show');
        },

        selectCard: function(event, data) {
            // console.log($('.treeview').treeview('getSelected')[0].parentId);
            console.log(event, data);
            if (data.parentId == undefined)
                return;
            var reader = this.$('#readers').treeview('getNode', data.parentId).text;
            this.currentReader = reader;
            this.formatAtr(reader, data.text);
        },

        connectCard: function() {
            if (this.$('#connectcard').html() == 'Disconnect') {
                linkManager.sendCommand({ command: 'disconnect', reader: this.currentReader});
            } else {
                linkManager.sendCommand({ command:'connect', reader: this.currentReader});
            }
        },

        apduSend: function() {
            var apdu = this.$('#apdu').val().replace(/\s/g,'');
            if (apdu.length %2 != 0) {
                this.appendToResponse("Error, byte string not an even number of characters\n");
                return;
            }
            linkManager.sendCommand({ command:'transmit', 
                reader: this.currentReader,
                apdu: apdu
            });
        },

        updatestatus: function (data) {
            console.log("PCSC live display: link status update");
        },

        clear: function () {
            console.log('Clear');
        },

        formatAtr: function(reader, atr) {
            var atrinfo = cardident.parseATR(atr);
            this.$('#atrinfo').html(atrinfo.atr_desc);
            var hits = '<ul>';
            for (var i = 0; i < atrinfo.candidates.length; i++) {
                hits += '<li>' + atrinfo.candidates[i] + '</li>';
            }
            hits += '</ul>';
            this.$('#candidates').html(hits);

            // Add a new tab if there are available utilities
            if (atrinfo.utilities != undefined) {
                var ut_names = {
                    mifare: 'Mifare',
                    mifare_ul: 'Mifare Ultralight',
                    calypso: 'Calypso'
                }
                for (var i = 0; i < atrinfo.utilities.length; i++) {
                    var un = atrinfo.utilities[i];
                    // Add a unique ID for the tab
                    var t = new Date().getTime();
                    this.$('#utilities').append('<li role="presentation"><a href="#' + un + t + '" role="tab" data-toggle="tab">' + ut_names[un] +
                    '&nbsp;<span data-utility="' + un + t + '" class="glyphicon glyphicon-remove utility_close" aria-hidden="true"></span></a></li>'
                    );
                    this.$('#utilities_content').append('<div role="tabpanel" class="tab-pane active" id="' + un + t + '"></div>');
                    $('#utilities a:last').tab('show');
                    this.loadExplorer(un, un + t, reader, atr);
                    $('#utilities a:first').tab('show');
                }
            }

        },

        loadExplorer: function(explorer_name, divid, reader, atr) {
            var self = this;
            // For now, this is not completely dynamic, we don't have enough explorers to justify this
            if (explorer_name == 'mifare') {
                require(['app/instruments/pcsc/mifare_explorer'], function(view) {
                    var ex = new view();
                    self.$('#' + divid).append(ex.el);
                    ex.render(reader, atr);
                 });     
            } else if (explorer_name == 'mifare_ul') {

            } else if (explorer_name == 'calypso') {

            } else if (explorer_name == 'pkcs15') {

            } else {
                console.error('Unknown explorer');
            }

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
                            this.$('#readers').on('nodeSelected', this.selectCard.bind(this));                            return;
                        } else if (data.action == 'added') {
                            // we are getting another 'added' message for an existing reader
                            // that we already knew. We get this when connecting/disconnectino
                            // from a smart card, so we just give up and return
                            return;
                        }
                    }
                }
                if (data.action != 'added')
                    return;
                // Didn't find the device
                this.readerlist.push({ text: data.device, nodes: []});
                this.$('#readers').treeview({ data:this.readerlist});
                this.$('#readers').on('nodeSelected', this.selectCard.bind(this));
                return;
            }

            if (data.data) {
                this.appendToResponse('\n' + data.data);
                return;
            }

            // Present when card inserted/removed
            if (data.status) {
                if (data.status == 'connected') {
                    this.$('#connectcard').html('Disconnect');
                    return;
                } else if (data.status == 'disconnected') {
                    this.$('#connectcard').html('Connect');
                    return;
                }
                if (data.status == 'card_inserted') {
                    for (var i = 0; i < this.readerlist.length; i++) {
                        if (this.readerlist[i].text == data.reader) {
                            if (this.readerlist[i].nodes.length)
                                return; // We got a new 'insert' on the same card
                            this.readerlist[i].nodes.push({text:abutils.ui8tohex(new Uint8Array(data.atr))});
                        }
                    }
                } else if (data.status == 'card_removed') {
                    for (var i = 0; i < this.readerlist.length; i++) {
                        if (this.readerlist[i].text == data.reader) {
                            this.readerlist[i].nodes = [];
                        }
                    }
                    // TODO: THIS ASSUMES WE ONLY HAVE ONE CARD CONNECTED AT ONE GIVEN TIME
                    // Remove ATR:
                    this.$('#atrinfo').empty();
                    this.$('#candidates').empty();

                }
                this.$('#readers').treeview({ data:this.readerlist});
                this.$('#readers').on('nodeSelected', this.selectCard.bind(this));
            }

            console.log('Data', data);

        },
    });

});