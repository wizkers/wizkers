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
 * Live view display of the output of the Cairn XL lantern
 *
 * @author Edouard Lafargue, ed@wizkers.io
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        simpleplot = require('app/lib/flotplot'),
        Beehive = require('beehive'),
        template = require('js/tpl/instruments/cairnxl/LiveView.js');

    // Need to load these, but no related variables.
    require('bootstrap');
    require('bootstrapslider');

    return Backbone.View.extend({

        initialize: function (options) {

            this.showstream = settings.get('showstream');
            this.beehive = new Beehive();

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
            "click #cmd-raw-send": "raw_send",
            "click #cmd-turnon": "turn_on",
            "click #cmd-turnoff": "turn_off",
            "click .beehive-picker": "pick_color",
            "slideStop #brightness-control": "change_brightness"
        },

        render: function () {
            var self = this;
            console.log('Main render of Cairn XL view');
            this.$el.html(template());
            this.$("#brightness-control").slider();

            this.beehive.Picker(this.$('#beehive')[0]);

            // Hide the raw data stream if we don't want it
            if (!this.showstream) {
                this.$('#showstream').css('visibility', 'hidden');
            }

            linkManager.requestStatus();
            return this;
        },

        onClose: function () {
            console.log("Cairn XL live view closing...");
            linkManager.stopLiveStream();
            linkManager.off('status', this.updatestatus);
            linkManager.off('input', this.showInput);
        },

        updatestatus: function (data) {
            console.log("Cairn XL live display: link status update");
            if (data.portopen && ! linkManager.isStreaming() ) {
                linkManager.startLiveStream();
            }
        },

        clear: function () {
        },

        pick_color: function(e) {
            var cc = this.beehive.getColorCode(e.currentTarget);
            linkManager.sendCommand({command: 'color', arg: cc});
        },

        raw_send: function() {
            var cmd = this.$("#cmd-raw-input").val();
            linkManager.sendCommand({command:'raw', arg: cmd});

        },

        turn_on: function() {
            linkManager.sendCommand({command:'power', arg: true});
        },

        turn_off: function() {
            linkManager.sendCommand({command:'power', arg: false});
        },

        change_brightness: function(e) {
            linkManager.sendCommand({command:'brightness', arg: e.value});
        },

        // We get there whenever we receive something from the serial port
        showInput: function (data) {
            var self = this;

            if (this.showstream) {
                // Update our raw data monitor
                var i = $('#input',this.el);
                var scroll = (i.val() + JSON.stringify(data) + '\n').split('\n');
                // Keep max 50 lines:
                if (scroll.length > 50) {
                    scroll = scroll.slice(scroll.length-50);
                }
                i.val(scroll.join('\n'));
                // Autoscroll:
                i.scrollTop(i[0].scrollHeight - i.height());
            }

            if (data.replay_ts != undefined) {
                this.suspend_graph = false;
                this.disp_wx(data.data, data.replay_ts);
                return;
            }

            // We're waiting for a data replay
            if (this.suspend_graph)
                return;

            // Grey out readings if we lost connectivity to the Kestrel 5 unit
            if (data.reconnecting != undefined ) {
                this.$('#liveview_in').css('color', data.reconnecting ? '#a1a1a1' : '#000000');
            }
        },
    });

});